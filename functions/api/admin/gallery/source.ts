import { z } from 'zod';
import { gallerySourceModeSchema, gallerySourceSchema } from '../../../../shared/schemas/gallerySource';
import { HttpError, ok, parseJson, requireAdmin } from '../../../lib/http';
import { extractDriveFolderId, getGallerySourceConfig, putGallerySourceConfig } from '../../../lib/gallerySource';
import type { Env } from '../../../lib/types';

const putSchema = z.object({
  mode: gallerySourceModeSchema,
  driveFolderUrl: z.string().optional(),
});

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const config = await getGallerySourceConfig(context.env);
  return ok(gallerySourceSchema.parse(config));
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const payload = await parseJson(context.request, putSchema);
  const driveFolderUrl = payload.driveFolderUrl?.trim() || undefined;
  const driveFolderId = extractDriveFolderId(driveFolderUrl);
  const current = await getGallerySourceConfig(context.env);

  if (payload.mode !== 'r2' && !driveFolderId) {
    throw new HttpError(400, 'INVALID_DRIVE_FOLDER_URL', 'A valid public Google Drive folder URL is required for drive or mixed mode');
  }

  const next = gallerySourceSchema.parse({
    mode: payload.mode,
    driveFolderUrl,
    driveFolderId,
    lastSyncedAt: current.lastSyncedAt,
  });
  await putGallerySourceConfig(context.env, next);
  return ok(next);
};
