import { z } from 'zod';
import { ok } from '../../lib/http';
import { ADMIN_GITHUB_USERNAMES_KEY, getAdditionalAdmins, getRepoOwner, normalizeUsernames } from '../../lib/githubAuth';
import type { Env } from '../../lib/types';

const schema = z.object({
  usernames: z.array(z.string()),
});

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const usernames = await getAdditionalAdmins(env);
  return ok({
    repoOwner: getRepoOwner(env),
    usernames,
  });
};

export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  const payload = schema.parse(await request.json());
  const repoOwner = getRepoOwner(env);
  const normalized = normalizeUsernames(payload.usernames);
  const usernames = normalized.filter((username) => username !== repoOwner);
  const ignored = normalized.includes(repoOwner) ? [repoOwner] : [];
  await env.FNLSTG_CONFIG.put(ADMIN_GITHUB_USERNAMES_KEY, JSON.stringify(usernames));
  return ok({
    repoOwner,
    usernames,
    ignored,
  });
};
