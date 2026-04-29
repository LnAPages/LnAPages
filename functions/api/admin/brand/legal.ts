import { parseJson, requireAdmin, ok } from '../../../lib/http';
import { upsertBrandLegal } from '../../../lib/brand';
import { brandLegalInputSchema } from '../../../../shared/schemas/brand';
import type { Env } from '../../../lib/types';

export const onRequestPut: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const payload = await parseJson(context.request, brandLegalInputSchema);
  const next = await upsertBrandLegal(context.env, payload);
  return ok(next);
};
