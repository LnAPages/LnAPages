import { z } from 'zod';
import { fail, ok, parseJson, requireAdmin } from '../../../../lib/http';
import type { Env } from '../../../../lib/types';

const CONTEXT_KEYS = ['hero', 'grid', 'service_card', 'product_card', 'blog', 'og', 'default'] as const;

const cropUpsertSchema = z.object({
  context_key: z.enum(CONTEXT_KEYS),
  aspect: z.string().default('free'),
  crop_x: z.number().min(0).max(1),
  crop_y: z.number().min(0).max(1),
  crop_width: z.number().min(0).max(1),
  crop_height: z.number().min(0).max(1),
  rotation: z.number().int().min(0).max(359).default(0),
  flip_h: z.boolean().default(false),
  flip_v: z.boolean().default(false),
});

const focalUpdateSchema = z.object({
  focal_x: z.number().min(0).max(1),
  focal_y: z.number().min(0).max(1),
});

type CropRow = {
  id: number;
  gallery_item_id: number;
  context_key: string;
  aspect: string;
  crop_x: number;
  crop_y: number;
  crop_width: number;
  crop_height: number;
  rotation: number;
  flip_h: number;
  flip_v: number;
  output_r2_key: string | null;
  output_width: number | null;
  output_height: number | null;
  created_at: string;
  updated_at: string;
};

function parseItemId(params: Record<string, string>): number | null {
  const raw = params.id;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** GET /api/admin/gallery/:id/crop — list all crops for an item */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const itemId = parseItemId(context.params as Record<string, string>);
  if (!itemId) return fail(400, 'INVALID_ID', 'Invalid gallery item id');

  const item = await context.env.LNAPAGES_DB
    .prepare('SELECT id FROM gallery_items WHERE id = ?')
    .bind(itemId)
    .first<{ id: number }>();
  if (!item) return fail(404, 'NOT_FOUND', 'Gallery item not found');

  const { results } = await context.env.LNAPAGES_DB
    .prepare('SELECT * FROM gallery_crops WHERE gallery_item_id = ? ORDER BY context_key')
    .bind(itemId)
    .all<CropRow>();

  return ok(results.map(mapCrop));
};

/** PUT /api/admin/gallery/:id/crop — upsert a crop for a context */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const itemId = parseItemId(context.params as Record<string, string>);
  if (!itemId) return fail(400, 'INVALID_ID', 'Invalid gallery item id');

  const payload = await parseJson(context.request, cropUpsertSchema);

  const item = await context.env.LNAPAGES_DB
    .prepare('SELECT id FROM gallery_items WHERE id = ?')
    .bind(itemId)
    .first<{ id: number }>();
  if (!item) return fail(404, 'NOT_FOUND', 'Gallery item not found');

  const existing = await context.env.LNAPAGES_DB
    .prepare('SELECT id FROM gallery_crops WHERE gallery_item_id = ? AND context_key = ?')
    .bind(itemId, payload.context_key)
    .first<{ id: number }>();

  if (existing) {
    await context.env.LNAPAGES_DB
      .prepare(
        `UPDATE gallery_crops SET
          aspect = ?, crop_x = ?, crop_y = ?, crop_width = ?, crop_height = ?,
          rotation = ?, flip_h = ?, flip_v = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(
        payload.aspect, payload.crop_x, payload.crop_y, payload.crop_width, payload.crop_height,
        payload.rotation, payload.flip_h ? 1 : 0, payload.flip_v ? 1 : 0,
        existing.id,
      )
      .run();
  } else {
    await context.env.LNAPAGES_DB
      .prepare(
        `INSERT INTO gallery_crops
          (gallery_item_id, context_key, aspect, crop_x, crop_y, crop_width, crop_height, rotation, flip_h, flip_v)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        itemId, payload.context_key, payload.aspect,
        payload.crop_x, payload.crop_y, payload.crop_width, payload.crop_height,
        payload.rotation, payload.flip_h ? 1 : 0, payload.flip_v ? 1 : 0,
      )
      .run();
  }

  const saved = await context.env.LNAPAGES_DB
    .prepare('SELECT * FROM gallery_crops WHERE gallery_item_id = ? AND context_key = ?')
    .bind(itemId, payload.context_key)
    .first<CropRow>();

  return ok(mapCrop(saved!));
};

/** DELETE /api/admin/gallery/:id/crop?context=hero — delete a specific context crop */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const itemId = parseItemId(context.params as Record<string, string>);
  if (!itemId) return fail(400, 'INVALID_ID', 'Invalid gallery item id');

  const url = new URL(context.request.url);
  const contextKey = url.searchParams.get('context');
  if (!contextKey || !CONTEXT_KEYS.includes(contextKey as (typeof CONTEXT_KEYS)[number])) {
    return fail(400, 'INVALID_CONTEXT', 'Valid context query param required');
  }

  const existing = await context.env.LNAPAGES_DB
    .prepare('SELECT id FROM gallery_crops WHERE gallery_item_id = ? AND context_key = ?')
    .bind(itemId, contextKey)
    .first<{ id: number }>();
  if (!existing) return fail(404, 'NOT_FOUND', 'Crop not found');

  await context.env.LNAPAGES_DB
    .prepare('DELETE FROM gallery_crops WHERE id = ?')
    .bind(existing.id)
    .run();

  return ok({ deleted: true, context_key: contextKey });
};

/** PATCH /api/admin/gallery/:id/crop — update focal point only */
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const itemId = parseItemId(context.params as Record<string, string>);
  if (!itemId) return fail(400, 'INVALID_ID', 'Invalid gallery item id');

  const payload = await parseJson(context.request, focalUpdateSchema);

  const item = await context.env.LNAPAGES_DB
    .prepare('SELECT id FROM gallery_items WHERE id = ?')
    .bind(itemId)
    .first<{ id: number }>();
  if (!item) return fail(404, 'NOT_FOUND', 'Gallery item not found');

  await context.env.LNAPAGES_DB
    .prepare('UPDATE gallery_items SET focal_x = ?, focal_y = ? WHERE id = ?')
    .bind(payload.focal_x, payload.focal_y, itemId)
    .run();

  return ok({ id: itemId, focal_x: payload.focal_x, focal_y: payload.focal_y });
};

function mapCrop(row: CropRow) {
  return {
    ...row,
    flip_h: row.flip_h === 1,
    flip_v: row.flip_v === 1,
  };
}
