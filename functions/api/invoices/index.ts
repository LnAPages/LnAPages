import { ok, requireAdmin } from '../../lib/http';
import type { Env } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const { results } = await context.env.LNAPAGES_DB.prepare('SELECT * FROM invoices ORDER BY issued_at DESC').all();
  return ok(results);
};
