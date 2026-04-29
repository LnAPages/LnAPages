import { siteConfigSchema } from '../../../shared/schemas/siteConfig';
import { ok, parseJson, requireAdmin } from '../../lib/http';
import type { Env } from '../../lib/types';

const KV_KEY = 'site-config';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const raw = await env.FNLSTG_CONFIG.get(KV_KEY, 'json');
  const parsed = siteConfigSchema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);

  return ok(siteConfigSchema.parse({}));
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const payload = await parseJson(context.request, siteConfigSchema);
  await context.env.FNLSTG_CONFIG.put(KV_KEY, JSON.stringify(payload));
  return ok(payload);
};
