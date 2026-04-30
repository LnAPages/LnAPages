import { inferGalleryKind, normalizeGalleryTags } from '../../../../shared/galleryUtils';
import {
  fetchDriveGalleryItems,
  getGallerySelectionOverrides,
  getDriveGalleryOverrides,
  getGallerySourceConfig,
  putGallerySourceConfig,
  resolveDriveCategoryAndTags,
} from '../../../lib/gallerySource';
import { ok, requireAdmin } from '../../../lib/http';
import type { Env } from '../../../lib/types';

function parseTagsJson(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((tag) => String(tag)).filter((tag) => tag.length > 0);
  } catch {
    return [];
  }
}

function toAssetUrl(raw: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  const key = raw.replace(/^\/+/, '');
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (!base) return `/${key}`;
  return `${base}/${key}`;
}

function mapGalleryRow(row: Record<string, unknown>, tags: string[] | undefined, baseUrl: string) {
  const key = String(row.r2_key ?? '').trim();
  const assetUrl = toAssetUrl(key, baseUrl);
  const resolvedTags =
    tags && tags.length > 0
      ? tags
      : normalizeGalleryTags(undefined, typeof row.category === 'string' ? row.category : undefined);
  return {
    ...row,
    r2_key: assetUrl,
    thumb_url: assetUrl,
    source: 'r2' as const,
    kind: row.kind === 'video' || row.kind === 'image' ? row.kind : inferGalleryKind(undefined, key),
    tags: resolvedTags,
    selected: true,
  };
}

function mapDriveItem(
  item: { driveId: string; title: string; url: string; thumbUrl: string },
  index: number,
  override?: { selected?: boolean; title?: string; alt?: string; category?: string; tags?: string[]; sort_order?: number },
) {
  const { category, tags } = resolveDriveCategoryAndTags(override?.category, override?.tags);
  return {
    id: `drive:${item.driveId}`,
    driveId: item.driveId,
    r2_key: item.url,
    thumb_url: item.thumbUrl,
    source: 'drive' as const,
    title: override?.title?.trim() || item.title,
    alt_text: override?.alt?.trim() || override?.title?.trim() || item.title,
    category,
    tags,
    selected: override?.selected === true,
    sort_order: override?.sort_order ?? 100000 + index,
    width: null,
    height: null,
    kind: 'image' as const,
    created_at: null,
  };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const { env } = context;
  const sourceConfig = await getGallerySourceConfig(env);
  const includeR2 = sourceConfig.mode === 'r2' || sourceConfig.mode === 'mixed';
  const includeDrive = sourceConfig.mode === 'drive' || sourceConfig.mode === 'mixed';
  const r2BaseUrl = env.R2_PUBLIC_BASE_URL ?? '';
  const selectionOverrides = await getGallerySelectionOverrides(env);

  let r2Items: Array<Record<string, unknown>> = [];
  if (includeR2) {
    try {
      const { results } = await env.LNAPAGES_DB.prepare(
        `SELECT gi.*,
                COALESCE(
                  (SELECT json_group_array(git.tag)
                   FROM gallery_item_tags git
                   WHERE git.gallery_item_id = gi.id),
                  '[]'
                ) AS tags_json
         FROM gallery_items gi
         ORDER BY gi.sort_order, gi.id`,
      ).all<Record<string, unknown>>();
      r2Items = results.map((row: Record<string, unknown>) => {
        const mapped = mapGalleryRow(row, parseTagsJson(row.tags_json), r2BaseUrl);
        const key = `r2:${String(row.id ?? '')}`;
        return { ...mapped, selected: selectionOverrides[key] ?? true };
      });
    } catch {
      const { results } = await env.LNAPAGES_DB.prepare('SELECT * FROM gallery_items ORDER BY sort_order, id').all<Record<string, unknown>>();
      r2Items = results.map((row: Record<string, unknown>) => {
        const mapped = mapGalleryRow(row, undefined, r2BaseUrl);
        const key = `r2:${String(row.id ?? '')}`;
        return { ...mapped, selected: selectionOverrides[key] ?? true };
      });
    }
  }

  let driveItems: Array<Record<string, unknown>> = [];
  if (includeDrive && sourceConfig.driveFolderId) {
    try {
      const files = await fetchDriveGalleryItems(env, sourceConfig.driveFolderId);
      const overrides = await getDriveGalleryOverrides(env);
      driveItems = files.map((item, index) => {
        const mapped = mapDriveItem(item, index, overrides[item.driveId]);
        const key = `drive:${item.driveId}`;
        return { ...mapped, selected: selectionOverrides[key] ?? mapped.selected };
      });
      const now = Date.now();
      if (!sourceConfig.lastSyncedAt || now - sourceConfig.lastSyncedAt > 60_000) {
        await putGallerySourceConfig(env, { ...sourceConfig, lastSyncedAt: now });
      }
    } catch {
      driveItems = [];
    }
  }

  let merged: Array<Record<string, unknown>> = r2Items;
  if (sourceConfig.mode === 'drive') merged = driveItems;
  else if (sourceConfig.mode === 'mixed') merged = [...r2Items, ...driveItems];

  const deduped: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  for (const item of merged) {
    const dedupeKey = String(item.id ?? item.r2_key ?? '');
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    deduped.push(item);
  }
  return ok(deduped);
};
