import { parseJson, requireAdmin, ok } from '../../../lib/http';
import { upsertBrandIdentity } from '../../../lib/brand';
import { brandIdentityInputSchema } from '../../../../shared/schemas/brand';
import type { Env } from '../../../lib/types';

export const onRequestPut: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const payload = await parseJson(context.request, brandIdentityInputSchema);
  const next = await upsertBrandIdentity(context.env, payload);
  return ok(next);
};
