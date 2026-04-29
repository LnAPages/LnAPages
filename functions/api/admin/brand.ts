import { requireAdmin, ok } from '../../lib/http';
import { readBrandAdmin } from '../../lib/brand';
import type { Env } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const payload = await readBrandAdmin(context.env);
  return ok(payload);
};
