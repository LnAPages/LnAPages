import { z } from 'zod';
import { CANONICAL_CATEGORY_SLUGS } from '../constants';

export const serviceCategorySchema = z.enum(CANONICAL_CATEGORY_SLUGS);

export const serviceSchema = z.object({
  id: z.number().int().positive().optional(),
  slug: z.string().min(2),
  name: z.string().min(2),
  description: z.string().min(2),
  duration_minutes: z.number().int().positive(),
  price_cents: z.number().int().nonnegative(),
  active: z.boolean().default(true),
  sort_order: z.number().int().nonnegative().default(0),
  category: serviceCategorySchema.optional(),
});

export const serviceCreateSchema = serviceSchema.omit({ id: true });
export const serviceUpdateSchema = serviceCreateSchema.partial();
export type Service = z.infer<typeof serviceSchema>;
