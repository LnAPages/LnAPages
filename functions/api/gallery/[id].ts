import { z } from 'zod';
import { normalizeGalleryTags } from '../../../shared/galleryUtils';
import { ok, requireAdmin } from '../../lib/http';
import type { Env } from '../../lib/types';

const idSchema = z.coerce.number().int().positive();
const patchSchema = z.object({
  sort_order: z.number().int().nonnegative().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  title: z.string().optional(),
  altText: z.string().optional(),
  alt_text: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const { env, params, request } = context;
  const id = idSchema.parse(params.id);
  const payload = patchSchema.parse(await request.json());
  const category = payload.category ?? (payload.tags ? normalizeGalleryTags(payload.tags)[0] : undefined);
  const sortOrder = payload.sort_order ?? payload.sortOrder;
  const altText = payload.alt_text ?? payload.altText;
  await env.LNAPAGES_DB.prepare(
    `UPDATE gallery_items SET
      sort_order = COALESCE(?, sort_order),
      title = COALESCE(?, title),
      alt_text = COALESCE(?, alt_text),
      category = COALESCE(?, category)
     WHERE id = ?`,
  ).bind(sortOrder ?? null, payload.title ?? null, altText ?? null, category ?? null, id).run();

  if (payload.tags) {
    const tags = normalizeGalleryTags(payload.tags, category);
    try {
      const statements = [
        env.LNAPAGES_DB.prepare('DELETE FROM gallery_item_tags WHERE gallery_item_id = ?').bind(id),
        ...tags.map((tag) =>
          env.LNAPAGES_DB.prepare('INSERT OR IGNORE INTO gallery_item_tags (gallery_item_id, tag) VALUES (?, ?)').bind(id, tag),
        ),
      ];
      await env.LNAPAGES_DB.batch(statements);
    } catch {
      // Best effort when migration has not been applied yet.
    }
  }
  return ok({ id });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const { env, params } = context;
  const id = idSchema.parse(params.id);
  const row = await env.LNAPAGES_DB.prepare('SELECT r2_key FROM gallery_items WHERE id = ?').bind(id).first<{ r2_key: string }>();
  if (row) await env.LNAPAGES_GALLERY.delete(row.r2_key);
  await env.LNAPAGES_DB.prepare('DELETE FROM gallery_items WHERE id = ?').bind(id).run();
  return ok({ id });
};
