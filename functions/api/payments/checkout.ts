import { z } from 'zod';
import Stripe from 'stripe';
import { fail, ok } from '../../lib/http';
import type { Env } from '../../lib/types';

// POST /api/payments/checkout
// Public endpoint (allow-listed in functions/_middleware.ts).
// Creates a booking row + a Stripe Checkout Session and returns the redirect URL.
// Supports deposit-only flow when the item has deposit_cents > 0 and the caller opts in.
const schema = z.object({
  item_id: z.number().int().positive(),
  customer_name: z.string().min(2),
  customer_email: z.string().email(),
  customer_phone: z.string().min(7),
  start_time: z.string().datetime(),
  hours_requested: z.number().positive().optional(),
  addon_item_ids: z.array(z.number().int().positive()).optional(),
  notes: z.string().max(2000).optional(),
  charge_mode: z.enum(['full', 'deposit']).default('full'),
});

function addMinutes(start: string, minutes: number): string {
  const date = new Date(start);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return date.toISOString();
}

type ItemRow = {
  id: number;
  type: string;
  name: string;
  billing_mode: string;
  duration_minutes: number | null;
  price_cents: number;
  deposit_cents: number;
  stripe_price_id: string | null;
  active: number;
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await request.json());
  } catch (err) {
    return fail(400, 'BAD_REQUEST', err instanceof Error ? err.message : 'Invalid payload');
  }

  if (!env.STRIPE_SECRET_KEY || !env.APP_URL) {
    return fail(500, 'MISCONFIGURED', 'Stripe is not configured on this environment');
  }

  const item = await env.FNLSTG_DB.prepare(
    `SELECT id, type, name, billing_mode, duration_minutes, price_cents, deposit_cents, stripe_price_id, active
     FROM items WHERE id = ? AND active = 1`,
  ).bind(payload.item_id).first<ItemRow>();
  if (!item) {
    return fail(404, 'NOT_FOUND', 'Item not found or inactive');
  }

  // Compute charge amount.
  const hours = payload.hours_requested ?? 1;
  const baseCents = item.billing_mode === 'hourly'
    ? Math.round(item.price_cents * hours)
    : item.price_cents;

  let chargeCents = baseCents;
  let depositCents = 0;
  if (payload.charge_mode === 'deposit' && item.deposit_cents > 0) {
    depositCents = item.deposit_cents;
    chargeCents = depositCents;
  }

  if (chargeCents <= 0) {
    return fail(400, 'INVALID_AMOUNT', 'Item has no price or deposit configured');
  }

  // Compute end_time (optional; services use duration_minutes, others fall back to +60m).
  const durationMinutes = item.duration_minutes ?? Math.round(60 * hours);
  const endTime = addMinutes(payload.start_time, durationMinutes);

  // Insert booking row up front so the session has a reference.
  const insert = await env.FNLSTG_DB.prepare(
    `INSERT INTO bookings (
       item_id, customer_name, customer_email, customer_phone,
       start_time, end_time, hours_requested, addon_item_ids,
       status, notes, amount_cents, deposit_amount_cents, paid_in_full,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, 0, datetime('now'), datetime('now'))`,
  )
    .bind(
      item.id,
      payload.customer_name,
      payload.customer_email,
      payload.customer_phone,
      payload.start_time,
      endTime,
      hours,
      JSON.stringify(payload.addon_item_ids ?? []),
      payload.notes ?? '',
      chargeCents,
      depositCents,
    )
    .run();

  const bookingId = Number(insert.meta.last_row_id ?? 0);
  if (!bookingId) {
    return fail(500, 'DB_ERROR', 'Failed to create booking row');
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      item.stripe_price_id
        ? { price: item.stripe_price_id, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: chargeCents,
              product_data: {
                name: depositCents > 0 ? `${item.name} (deposit)` : item.name,
              },
            },
          },
    ],
    success_url: `${env.APP_URL}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/booking`,
    customer_email: payload.customer_email,
    metadata: {
      booking_id: String(bookingId),
      item_id: String(item.id),
      charge_mode: payload.charge_mode,
    },
  });

  await env.FNLSTG_DB.prepare(
    'UPDATE bookings SET stripe_session_id = ?, updated_at = datetime(\'now\') WHERE id = ?',
  ).bind(session.id, bookingId).run();

  return ok({
    booking_id: bookingId,
    session_id: session.id,
    url: session.url ?? `${env.APP_URL}/booking/success`,
    amount_cents: chargeCents,
    deposit_amount_cents: depositCents,
  });
};
