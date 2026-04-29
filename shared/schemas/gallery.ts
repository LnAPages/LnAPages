import { z } from 'zod';

export const galleryItemSchema = z.object({
  id: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
  driveId: z.string().optional(),
  r2_key: z.string().min(1),
  thumb_url: z.string().min(1).optional(),
  source: z.enum(['r2', 'drive']).default('r2'),
  title: z.string().default(''),
  alt_text: z.string().default(''),
  category: z.string().default('general'),
  tags: z.array(z.string()).default([]),
  selected: z.boolean().optional(),
  sort_order: z.number().int().nonnegative().default(0),
  width: z.number().int().nonnegative().nullable().default(null),
  height: z.number().int().nonnegative().nullable().default(null),
  kind: z.enum(['image', 'video']).optional(),
  focal_x: z.number().min(0).max(1).nullable().optional(),
  focal_y: z.number().min(0).max(1).nullable().optional(),
  dominant_color: z.string().nullable().optional(),
});

export const galleryCropSchema = z.object({
  id: z.number().int().positive().optional(),
  gallery_item_id: z.number().int().positive(),
  context_key: z.enum(['hero', 'grid', 'service_card', 'product_card', 'blog', 'og', 'default']),
  aspect: z.string().default('free'),
  crop_x: z.number().min(0).max(1),
  crop_y: z.number().min(0).max(1),
  crop_width: z.number().min(0).max(1),
  crop_height: z.number().min(0).max(1),
  rotation: z.number().int().min(0).max(359).default(0),
  flip_h: z.boolean().default(false),
  flip_v: z.boolean().default(false),
  output_r2_key: z.string().nullable().optional(),
  output_width: z.number().int().nonnegative().nullable().optional(),
  output_height: z.number().int().nonnegative().nullable().optional(),
});

export const galleryReorderSchema = z.object({
  items: z.array(z.object({ id: z.number().int().positive(), sort_order: z.number().int().nonnegative() })),
});

export type GalleryItem = z.infer<typeof galleryItemSchema>;
export type GalleryCrop = z.infer<typeof galleryCropSchema>;
