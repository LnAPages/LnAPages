import { OAUTH_STATE_PREFIX, requireGitHubOAuth } from '../../../lib/githubAuth';
import type { Env } from '../../../lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  requireGitHubOAuth(env);

  const state = crypto.randomUUID();
  await env.LNAPAGES_CONFIG.put(`${OAUTH_STATE_PREFIX}${state}`, '1', { expirationTtl: 600 });

  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', env.GITHUB_OAUTH_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', `${env.APP_URL}/api/auth/github/callback`);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('scope', 'read:user');

  return new Response(null, { status: 302, headers: { Location: authorizeUrl.toString() } });
};
