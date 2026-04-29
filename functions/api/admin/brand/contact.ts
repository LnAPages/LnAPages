import { parseJson, requireAdmin, ok } from '../../../lib/http';
import { upsertBrandContact } from '../../../lib/brand';
import { brandContactInputSchema } from '../../../../shared/schemas/brand';
import type { Env } from '../../../lib/types';

export const onRequestPut: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const payload = await parseJson(context.request, brandContactInputSchema);
  const next = await upsertBrandContact(context.env, payload);
  return ok(next);
};
