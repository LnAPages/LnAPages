import { z } from 'zod';
import { HttpError } from '../../../lib/http';
import { OAUTH_STATE_PREFIX, isAllowedAdmin, requireGitHubOAuth } from '../../../lib/githubAuth';
import type { Env } from '../../../lib/types';

const schema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

type GitHubTokenResponse = { access_token?: string; error?: string; error_description?: string };
type GitHubUserResponse = { login?: string; name?: string };

function redirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  requireGitHubOAuth(env);

  const url = new URL(request.url);
  const { code, state } = schema.parse({
    code: url.searchParams.get('code') ?? '',
    state: url.searchParams.get('state') ?? '',
  });

  const stateKey = `${OAUTH_STATE_PREFIX}${state}`;
  const stateValue = await env.FNLSTG_CONFIG.get(stateKey);
  if (!stateValue) throw new HttpError(401, 'INVALID_STATE', 'OAuth state is invalid or expired');
  await env.FNLSTG_CONFIG.delete(stateKey);

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: `${env.APP_URL}/api/auth/github/callback`,
      state,
    }),
  });

  const tokenPayload = (await tokenResponse.json()) as GitHubTokenResponse;
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new HttpError(401, 'OAUTH_EXCHANGE_FAILED', tokenPayload.error_description || tokenPayload.error || 'OAuth exchange failed');
  }

  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${tokenPayload.access_token}`,
      'User-Agent': 'FNLSTG',
    },
  });
  const githubUser = (await userResponse.json()) as GitHubUserResponse;
  const username = (githubUser.login || '').trim().toLowerCase();
  if (!userResponse.ok || !username) throw new HttpError(401, 'OAUTH_USER_FAILED', 'Unable to read GitHub user profile');

  if (!(await isAllowedAdmin(env, username))) {
    return redirect('/admin/login?error=unauthorized');
  }

  const email = `github+${username}@internal.fnlstage.com`;
  const existing = await env.FNLSTG_DB.prepare('SELECT id FROM admin_users WHERE email = ?').bind(email).first<{ id: number }>();
  let userId = existing?.id ?? 0;
  if (!userId) {
    const result = await env.FNLSTG_DB.prepare("INSERT INTO admin_users (email, name, created_at) VALUES (?, ?, datetime('now'))")
      .bind(email, githubUser.name?.trim() || username)
      .run();
    userId = Number(result.meta.last_row_id ?? 0);
  }

  const token = crypto.randomUUID();
  await env.FNLSTG_DB.prepare(`INSERT INTO admin_sessions (user_id, token, expires_at, created_at)
                               VALUES (?, ?, datetime('now', '+30 days'), datetime('now'))`)
    .bind(userId, token)
    .run();

  const headers = new Headers({ Location: '/admin' });
  headers.append('Set-Cookie', `session_token=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`);
  return new Response(null, { status: 302, headers });
};
