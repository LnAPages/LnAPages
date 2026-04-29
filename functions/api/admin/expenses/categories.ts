import { ok, requireAdmin } from '../../../lib/http';
import type { Env } from '../../../lib/types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const rows = await context.env.FNLSTG_DB
    .prepare(`SELECT id, slug, name, color, sort_order FROM expense_categories ORDER BY sort_order, name`)
    .all();
  return ok(rows.results);
};
