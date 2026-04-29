import { z } from 'zod';

/**
 * Booking schema (unified items model).
 *
 * Bookings now reference items.id rather than the old services.id.
 * See docs/SCHEMA.md and migrations/0004_unified_items.sql.
 */

export const bookingStatusSchema = z.enum([
  'pending',
  'confirmed',
  'paid',
  'cancelled',
  'completed',
]);

export const bookingSchema = z.object({
  id: z.number().int().positive().optional(),
  item_id: z.number().int().positive(),
  customer_name: z.string().min(2),
  customer_email: z.email(),
  customer_phone: z.string().min(7),
  start_time: z.string().datetime(),
  end_time: z.string().datetime().optional().nullable(),
  hours_requested: z.number().positive().nullable().optional(),
  addon_item_ids: z.array(z.number().int().positive()).default([]),
  deposit_paid: z.boolean().default(false),
  status: bookingStatusSchema.default('pending'),
  notes: z.string().optional().default(''),
  stripe_session_id: z.string().optional().nullable(),
  stripe_payment_intent: z.string().optional().nullable(),
  amount_cents: z.number().int().nonnegative().optional(),
});

export const bookingCreateSchema = bookingSchema.omit({
  id: true,
  status: true,
  stripe_session_id: true,
  stripe_payment_intent: true,
  amount_cents: true,
});

export const bookingUpdateSchema = bookingSchema.partial();
export type Booking = z.infer<typeof bookingSchema>;
