import { z } from 'zod';

/**
 * Intake (inquiry) schema.
 *
 * Intakes may optionally reference an item (service or product) so inquiries
 * captured from a specific item's page can be attributed to that item.
 * See docs/SCHEMA.md and migrations/0004_unified_items.sql.
 */

export const intakeStatusSchema = z.enum(['new', 'read', 'replied', 'archived']);

export const intakeSchema = z.object({
  id: z.number().int().positive().optional(),
  item_id: z.number().int().positive().nullable().optional(),
  name: z.string().min(2),
  email: z.email(),
  phone: z.string().min(7),
  project_type: z.string().min(2),
  budget: z.string().optional().nullable(),
  timeline: z.string().optional().nullable(),
  message: z.string().min(5),
  status: intakeStatusSchema.default('new'),
});

export const intakeCreateSchema = intakeSchema.omit({ id: true, status: true });
export const intakeUpdateSchema = intakeSchema.partial();
export type Intake = z.infer<typeof intakeSchema>;
