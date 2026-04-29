import { z } from 'zod';
import { fail, ok, parseJson, requireAdmin } from '../../../../lib/http';
import type { Env } from '../../../../lib/types';

const focalUpdateSchema = z.object({
  focal_x: z.number().min(0).max(1),
  focal_y: z.number().min(0).max(1),
});

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const itemId = Number(context.params.id);
  if (!Number.isFinite(itemId) || itemId <= 0) {
    return fail(400, 'BAD_ID', 'Invalid gallery item id');
  }
  const body = await parseJson(context.request, focalUpdateSchema);
  const result = await context.env.FNLSTG_DB
    .prepare('UPDATE gallery_items SET focal_x = ?, focal_y = ? WHERE id = ?')
    .bind(body.focal_x, body.focal_y, itemId)
    .run();
  if (!result.success) {
    return fail(500, 'DB_ERROR', 'Failed to update focal point');
  }
  return ok({ id: itemId, focal_x: body.focal_x, focal_y: body.focal_y });
};
