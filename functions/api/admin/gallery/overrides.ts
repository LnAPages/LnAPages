import { z } from 'zod';
import { CANONICAL_CATEGORY_SLUGS } from '../../../../shared/constants';
import { fail, HttpError, ok, parseJson, requireAdmin } from '../../../lib/http';
import { getDriveGalleryOverrides, putDriveGalleryOverride, putGallerySelectionOverride } from '../../../lib/gallerySource';
import type { Env } from '../../../lib/types';

const driveIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{10,}$/);
const DRIVE_PREFIX = 'drive:';
const itemKeySchema = z.string().regex(/^(drive:[a-zA-Z0-9_-]{10,}|r2:\d+)$/);

const overridePatchSchema = z.object({
  selected: z.boolean().optional(),
  title: z.string().optional(),
  alt: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sort_order: z.number().int().nonnegative().optional(),
});

const putSchema = z.object({
  driveId: driveIdSchema.optional(),
  itemKey: itemKeySchema.optional(),
  override: overridePatchSchema,
}).refine((payload) => payload.driveId || payload.itemKey, {
  message: 'Either driveId or itemKey must be provided',
});

const deleteSchema = z.object({
  driveId: driveIdSchema,
});

async function readServiceSlugs(env: Env): Promise<Set<string>> {
  try {
    const { results } = await env.FNLSTG_DB.prepare(`SELECT slug FROM items WHERE type IN ('service','bundle')`).all<{ slug: string }>();
    return new Set(results.map((row: { slug: string }) => String(row.slug).trim()).filter(Boolean));
  } catch {
    const { results } = await env.FNLSTG_DB.prepare('SELECT slug FROM services').all<{ slug: string }>();
    return new Set(results.map((row: { slug: string }) => String(row.slug).trim()).filter(Boolean));
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const overrides = await getDriveGalleryOverrides(context.env);
  return ok(overrides);
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const payload = await parseJson(context.request, putSchema);
  const driveId = payload.driveId ?? (payload.itemKey?.startsWith(DRIVE_PREFIX) ? payload.itemKey.slice(DRIVE_PREFIX.length) : undefined);
  const selectionKey = payload.itemKey ?? (driveId ? `drive:${driveId}` : undefined);

  const current = await getDriveGalleryOverrides(context.env);
  const existing = driveId ? (current[driveId] ?? {}) : {};

  const category = payload.override.category?.trim();
  if (category && !CANONICAL_CATEGORY_SLUGS.includes(category as (typeof CANONICAL_CATEGORY_SLUGS)[number])) {
    return fail(400, 'INVALID_CATEGORY', 'Invalid category');
  }

  const tags = payload.override.tags?.map((tag) => String(tag).trim()).filter(Boolean);
  if (tags && tags.length > 0) {
    const validSlugs = await readServiceSlugs(context.env);
    const invalid = tags.filter((tag) => !validSlugs.has(tag));
    if (invalid.length > 0) {
      return Response.json({ ok: false, error: { code: 'INVALID_TAGS', invalid } }, { status: 400 });
    }
  }

  const next = {
    ...existing,
    ...(payload.override.selected === undefined ? {} : { selected: payload.override.selected }),
    ...(payload.override.title === undefined ? {} : { title: payload.override.title.trim() || undefined }),
    ...(payload.override.alt === undefined ? {} : { alt: payload.override.alt.trim() || undefined }),
    ...(payload.override.category === undefined ? {} : { category: category || undefined }),
    ...(payload.override.tags === undefined ? {} : { tags }),
    ...(payload.override.sort_order === undefined ? {} : { sort_order: payload.override.sort_order }),
  };

  if (selectionKey && payload.override.selected !== undefined) {
    await putGallerySelectionOverride(context.env, selectionKey, payload.override.selected);
  }

  if (driveId) {
    const saved = await putDriveGalleryOverride(context.env, driveId, next);
    return ok({ driveId, itemKey: selectionKey, override: saved });
  }

  return ok({ itemKey: selectionKey, override: { selected: payload.override.selected } });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const payload = await parseJson(context.request, deleteSchema);
  const current = await getDriveGalleryOverrides(context.env);
  if (!current[payload.driveId]) {
    throw new HttpError(404, 'NOT_FOUND', 'Override not found');
  }
  await putDriveGalleryOverride(context.env, payload.driveId, {});
  return ok({ driveId: payload.driveId });
};
