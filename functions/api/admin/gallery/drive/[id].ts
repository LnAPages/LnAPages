import { z } from 'zod';
import { ok, parseJson, requireAdmin } from '../../../../lib/http';
import { getDriveGalleryOverrides, putDriveGalleryOverride, resolveDriveCategoryAndTags } from '../../../../lib/gallerySource';
import type { Env } from '../../../../lib/types';

const driveIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{10,}$/);

const putSchema = z.object({
  title: z.string().optional(),
  alt_text: z.string().optional(),
  alt: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sort_order: z.number().int().nonnegative().optional(),
});

export const onRequestPut: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const driveId = driveIdSchema.parse(context.params.id);
  const payload = await parseJson(context.request, putSchema);
  const existing = (await getDriveGalleryOverrides(context.env))[driveId] ?? {};
  const normalized = resolveDriveCategoryAndTags(payload.category, payload.tags);

  const saved = await putDriveGalleryOverride(context.env, driveId, {
    selected: existing.selected,
    title: payload.title?.trim() || undefined,
    alt: payload.alt?.trim() || payload.alt_text?.trim() || undefined,
    category: normalized.category,
    tags: normalized.tags,
    sort_order: payload.sort_order,
  });

  return ok({
    id: `drive:${driveId}`,
    source: 'drive',
    ...saved,
  });
};
