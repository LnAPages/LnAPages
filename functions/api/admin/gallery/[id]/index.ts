import { normalizeGalleryTags } from '../../../../../shared/galleryUtils';
import { fail, ok, requireAdmin } from '../../../../lib/http';
import type { Env } from '../../../../lib/types';

type GalleryRow = {
  id: number;
  r2_key: string;
  title: string | null;
  alt_text: string | null;
  category: string | null;
  sort_order: number;
  width: number | null;
  height: number | null;
  kind: string | null;
  focal_x: number | null;
  focal_y: number | null;
  dominant_color: string | null;
  tags_json: string | null;
};

function parseItemId(params: Record<string, string>): number | null {
  const raw = params.id;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const itemId = parseItemId(context.params as Record<string, string>);
  if (!itemId) return fail(400, 'INVALID_ID', 'Invalid gallery item id');

  const r2BaseUrl = context.env.R2_PUBLIC_BASE_URL ?? '';

  const row = await context.env.LNAPAGES_DB
    .prepare(
      `SELECT gi.*,
              COALESCE(
                (SELECT json_group_array(git.tag)
                 FROM gallery_item_tags git
                 WHERE git.gallery_item_id = gi.id),
                '[]'
              ) AS tags_json
       FROM gallery_items gi
       WHERE gi.id = ?`,
    )
    .bind(itemId)
    .first<GalleryRow>();

  if (!row) return fail(404, 'NOT_FOUND', 'Gallery item not found');

  let tags: string[] = [];
  try { tags = JSON.parse(row.tags_json ?? '[]'); } catch { /* */ }
  if (!Array.isArray(tags)) tags = [];

  const resolvedTags = tags.length > 0 ? tags : normalizeGalleryTags(undefined, row.category ?? undefined);

  function toAssetUrl(raw: string): string {
    if (/^https?:\/\//i.test(raw)) return raw;
    const key = raw.replace(/^\/+/, '');
    const base = r2BaseUrl.trim().replace(/\/+$/, '');
    if (!base) return `/${key}`;
    return `${base}/${key}`;
  }

  const assetUrl = toAssetUrl(row.r2_key ?? '');

  return ok({
    id: row.id,
    r2_key: assetUrl,
    thumb_url: assetUrl,
    source: 'r2' as const,
    title: row.title ?? '',
    alt_text: row.alt_text ?? '',
    category: row.category ?? 'general',
    tags: resolvedTags,
    selected: true,
    sort_order: row.sort_order,
    width: row.width,
    height: row.height,
    kind: row.kind === 'video' ? 'video' : 'image',
    focal_x: row.focal_x,
    focal_y: row.focal_y,
    dominant_color: row.dominant_color,
  });
};
