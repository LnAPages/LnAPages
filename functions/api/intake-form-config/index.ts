import { intakeFormConfigSchema } from '../../../shared/schemas/intakeFormConfig';
import { ok, parseJson, requireAdmin } from '../../lib/http';
import type { Env } from '../../lib/types';

const KV_KEY = 'intake-form-config';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const raw = await env.LNAPAGES_CONFIG.get(KV_KEY, 'json');
  const parsed = intakeFormConfigSchema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  return ok(intakeFormConfigSchema.parse({}));
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const payload = await parseJson(context.request, intakeFormConfigSchema);
  await context.env.LNAPAGES_CONFIG.put(KV_KEY, JSON.stringify(payload));
  return ok(payload);
};
