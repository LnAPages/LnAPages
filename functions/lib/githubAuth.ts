import { HttpError } from './http';
import type { Env } from './types';

export const OAUTH_STATE_PREFIX = 'oauth_state:';
export const ADMIN_GITHUB_USERNAMES_KEY = 'admin-github-usernames';

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function getRepoOwner(env: Env): string {
  const owner = normalizeUsername(env.GITHUB_REPO_OWNER || '');
  if (!owner) throw new HttpError(500, 'CONFIG_ERROR', 'Missing GITHUB_REPO_OWNER');
  return owner;
}

export function normalizeUsernames(usernames: string[]): string[] {
  return [...new Set(usernames.map(normalizeUsername).filter(Boolean))];
}

export async function getAdditionalAdmins(env: Env): Promise<string[]> {
  const raw = await env.FNLSTG_CONFIG.get(ADMIN_GITHUB_USERNAMES_KEY, 'json');
  if (!Array.isArray(raw)) return [];
  return normalizeUsernames(raw.filter((item): item is string => typeof item === 'string'));
}

export async function isAllowedAdmin(env: Env, username: string): Promise<boolean> {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) return false;
  if (normalizedUsername === getRepoOwner(env)) return true;
  const admins = await getAdditionalAdmins(env);
  return admins.includes(normalizedUsername);
}

export function requireGitHubOAuth(env: Env): void {
  if (!env.GITHUB_OAUTH_CLIENT_ID) throw new HttpError(500, 'CONFIG_ERROR', 'Missing GITHUB_OAUTH_CLIENT_ID');
  if (!env.GITHUB_OAUTH_CLIENT_SECRET) throw new HttpError(500, 'CONFIG_ERROR', 'Missing GITHUB_OAUTH_CLIENT_SECRET');
  if (!env.APP_URL) throw new HttpError(500, 'CONFIG_ERROR', 'Missing APP_URL');
}
