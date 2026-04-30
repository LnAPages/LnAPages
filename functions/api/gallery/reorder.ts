import { galleryReorderSchema } from '../../../shared/schemas/gallery';
import { ok, parseJson, requireAdmin } from '../../lib/http';
import type { Env } from '../../lib/types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const payload = await parseJson(context.request, galleryReorderSchema);
  const statements = payload.items.map((item) => context.env.LNAPAGES_DB.prepare('UPDATE gallery_items SET sort_order = ? WHERE id = ?').bind(item.sort_order, item.id));
  await context.env.LNAPAGES_DB.batch(statements);
  return ok({ updated: payload.items.length });
};
