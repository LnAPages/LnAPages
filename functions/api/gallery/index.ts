import { z } from 'zod';
import { inferGalleryKind, normalizeGalleryTags } from '../../../shared/galleryUtils';
import {
  fetchDriveGalleryItems,
  getGallerySelectionOverrides,
  getDriveGalleryOverrides,
  getGallerySourceConfig,
  putGallerySourceConfig,
  resolveDriveCategoryAndTags,
} from '../../lib/gallerySource';
import { ok, parseJson, requireAdmin } from '../../lib/http';
import type { Env } from '../../lib/types';

const createSchema = z
  .object({
    key: z.string().min(1).optional(),
    r2_key: z.string().min(1).optional(),
    title: z.string().optional(),
    altText: z.string().optional(),
    alt_text: z.string().optional(),
    tags: z.array(z.string()).optional(),
    category: z.string().optional(),
    sortOrder: z.number().int().nonnegative().optional(),
    sort_order: z.number().int().nonnegative().optional(),
    width: z.number().int().nonnegative().nullable().optional(),
    height: z.number().int().nonnegative().nullable().optional(),
    kind: z.enum(['image', 'video']).optional(),
    mimeType: z.string().optional(),
    mime_type: z.string().optional(),
  })
  .refine((payload) => Boolean(payload.key || payload.r2_key), {
    message: 'key (or r2_key) is required',
  });

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

async function insertGalleryItem(
  env: Env,
  args: {
    r2Key: string;
    title: string;
    altText: string;
    category: string;
    sortOrder: number;
    width: number | null | undefined;
    height: number | null | undefined;
    kind: 'image' | 'video';
  },
) {
  const bindings = [args.r2Key, args.title, args.altText, args.category, args.sortOrder, args.width ?? null, args.height ?? null];
  try {
    return await env.FNLSTG_DB.prepare(
      `INSERT INTO gallery_items (r2_key, title, alt_text, category, sort_order, width, height, kind, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
      .bind(...bindings, args.kind)
      .run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/no column named kind/i.test(message)) throw error;
    return env.FNLSTG_DB.prepare(
      `INSERT INTO gallery_items (r2_key, title, alt_text, category, sort_order, width, height, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
      .bind(...bindings)
      .run();
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const sourceConfig = await getGallerySourceConfig(env);
  const includeR2 = sourceConfig.mode === 'r2' || sourceConfig.mode === 'mixed';
  const includeDrive = sourceConfig.mode === 'drive' || sourceConfig.mode === 'mixed';
  const r2BaseUrl = env.R2_PUBLIC_BASE_URL ?? '';
  const selectionOverrides = await getGallerySelectionOverrides(env);

  let r2Items: Array<Record<string, unknown>> = [];
  if (includeR2) {
    try {
      const { results } = await env.FNLSTG_DB.prepare(
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
      r2Items = results.map((row) => {
        const mapped = mapGalleryRow(row, parseTagsJson(row.tags_json), r2BaseUrl);
        const key = `r2:${String(row.id ?? '')}`;
        return { ...mapped, selected: selectionOverrides[key] ?? true };
      });
    } catch {
      const { results } = await env.FNLSTG_DB.prepare('SELECT * FROM gallery_items ORDER BY sort_order, id').all<Record<string, unknown>>();
      r2Items = results.map((row) => {
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
  if (sourceConfig.mode === 'drive') {
    merged = driveItems;
  } else if (sourceConfig.mode === 'mixed') {
    merged = [...r2Items, ...driveItems];
  }
  const deduped: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  for (const item of merged) {
    const dedupeKey = String(item.id ?? item.r2_key ?? '');
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    deduped.push(item);
  }

  return ok(deduped.filter((item) => item.selected === true));
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const { env, request } = context;

  const payload = await parseJson(request, createSchema);
  const r2Key = payload.key ?? payload.r2_key ?? '';
  const title = payload.title ?? '';
  const altText = payload.altText ?? payload.alt_text ?? '';
  const sortOrder = payload.sortOrder ?? payload.sort_order ?? 0;
  const category = (payload.category ?? '').trim() || 'general';
  const kind = payload.kind ?? inferGalleryKind(payload.mimeType ?? payload.mime_type, r2Key);
  const tags = normalizeGalleryTags(payload.tags, category);

  const result = await insertGalleryItem(env, {
    r2Key,
    title,
    altText,
    category,
    sortOrder,
    width: payload.width,
    height: payload.height,
    kind,
  });

  const id = Number(result.meta.last_row_id ?? 0);
  try {
    await env.FNLSTG_DB.batch(
      tags.map((tag) =>
        env.FNLSTG_DB.prepare('INSERT OR IGNORE INTO gallery_item_tags (gallery_item_id, tag) VALUES (?, ?)').bind(id, tag),
      ),
    );
  } catch {
    // Best effort when migration has not been applied yet.
  }

  return ok(
    {
      id,
      r2_key: r2Key,
      title,
      alt_text: altText,
      category,
      sort_order: sortOrder,
      width: payload.width ?? null,
      height: payload.height ?? null,
      kind,
      tags,
    },
    201,
  );
};
