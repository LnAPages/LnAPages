import {
  fetchDriveGalleryItems,
  GALLERY_DRIVE_OVERRIDES_KV_KEY,
  getDriveGalleryOverrides,
  getGallerySourceConfig,
} from '../../../lib/gallerySource';
import { fail, ok, requireAdmin } from '../../../lib/http';
import type { Env } from '../../../lib/types';

const MIGRATION_KEY = 'migrations.select-all-done';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const { env } = context;

  const alreadyRan = await env.LNAPAGES_CONFIG.get(MIGRATION_KEY);
  if (alreadyRan) {
    return fail(409, 'ALREADY_RAN', 'Select-all migration already ran');
  }

  const source = await getGallerySourceConfig(env);
  if (!source.driveFolderId) {
    return fail(400, 'DRIVE_FOLDER_REQUIRED', 'Drive folder is not configured');
  }

  const files = await fetchDriveGalleryItems(env, source.driveFolderId);
  const overrides = await getDriveGalleryOverrides(env);
  let inserted = 0;
  for (const file of files) {
    if (overrides[file.driveId]) continue;
    overrides[file.driveId] = { selected: true };
    inserted += 1;
  }

  await env.LNAPAGES_CONFIG.put(GALLERY_DRIVE_OVERRIDES_KV_KEY, JSON.stringify(overrides));
  await env.LNAPAGES_CONFIG.put(MIGRATION_KEY, new Date().toISOString());

  return ok({
    inserted,
    totalDriveFiles: files.length,
    migrationKey: MIGRATION_KEY,
  });
};
