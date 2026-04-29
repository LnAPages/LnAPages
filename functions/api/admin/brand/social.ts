import { parseJson, requireAdmin, ok } from '../../../lib/http';
import { upsertBrandSocial } from '../../../lib/brand';
import { brandSocialInputSchema } from '../../../../shared/schemas/brand';
import type { Env } from '../../../lib/types';

export const onRequestPut: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const payload = await parseJson(context.request, brandSocialInputSchema);
  const next = await upsertBrandSocial(context.env, payload);
  return ok(next);
};
