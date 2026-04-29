import { z } from 'zod';

export const invoiceSchema = z.object({
  id: z.number().int().positive().optional(),
  booking_id: z.number().int().positive(),
  number: z.string().min(1),
  r2_key: z.string().min(1),
  amount_cents: z.number().int().nonnegative(),
  issued_at: z.string().datetime(),
  paid_at: z.string().datetime().nullable().optional(),
});

export const invoiceCreateSchema = invoiceSchema.omit({ id: true });
export type Invoice = z.infer<typeof invoiceSchema>;
