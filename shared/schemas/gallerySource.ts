import { z } from 'zod';

export const gallerySourceModeSchema = z.enum(['r2', 'drive', 'mixed']);

export const gallerySourceSchema = z.object({
  mode: gallerySourceModeSchema.default('r2'),
  driveFolderUrl: z.string().optional(),
  driveFolderId: z.string().optional(),
  lastSyncedAt: z.number().int().nonnegative().optional(),
});

export type GallerySourceConfig = z.infer<typeof gallerySourceSchema>;
