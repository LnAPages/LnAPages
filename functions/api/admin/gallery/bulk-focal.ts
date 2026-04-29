import { z } from 'zod';
import { ok, parseJson, requireAdmin } from '../../../lib/http';
import type { Env } from '../../../lib/types';

const bulkFocalSchema = z.object({
  items: z.array(z.object({
    id: z.number().int().positive(),
    focal_x: z.number().min(0).max(1),
    focal_y: z.number().min(0).max(1),
  })).min(1).max(200),
});

/** POST /api/admin/gallery/bulk-focal — bulk-update focal_x/focal_y on gallery_items */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const { items } = await parseJson(context.request, bulkFocalSchema);

  const stmts = items.map((item) =>
    context.env.FNLSTG_DB
      .prepare('UPDATE gallery_items SET focal_x = ?, focal_y = ? WHERE id = ?')
      .bind(item.focal_x, item.focal_y, item.id),
  );
  await context.env.FNLSTG_DB.batch(stmts);

  return ok({ updated: items.length });
};
