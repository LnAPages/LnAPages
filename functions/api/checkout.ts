import { z } from 'zod';
import Stripe from 'stripe';
import { fail, ok } from '../lib/http';
import type { Env } from '../lib/types';

const schema = z.object({
  serviceId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().min(1),
  contact: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(7),
    notes: z.string().max(2000).optional().default(''),
  }),
});

type ItemRow = {
  id: number;
  name: string;
  billing_mode: 'one_time' | 'hourly' | 'monthly_retainer';
  duration_minutes: number | null;
  price_cents: number;
  active: number;
};

const timeMap: Record<string, string> = {
  '9:00 AM': '09:00',
  '10:30 AM': '10:30',
  '12:00 PM': '12:00',
  '1:30 PM': '13:30',
  '3:00 PM': '15:00',
  '4:30 PM': '16:30',
  Sunset: '19:30',
};

function addMinutes(startIso: string, minutes: number): string {
  const date = new Date(startIso);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return date.toISOString();
}

function toIsoStart(date: string, timeLabel: string): string {
  const hhmm = timeMap[timeLabel] ?? timeMap['12:00 PM'];
  return new Date(`${date}T${hhmm}:00`).toISOString();
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await request.json());
  } catch (error) {
    return fail(400, 'BAD_REQUEST', error instanceof Error ? error.message : 'Invalid payload');
  }

  if (!env.STRIPE_SECRET_KEY || !env.APP_URL) {
    return fail(500, 'MISCONFIGURED', 'Stripe is not configured on this environment');
  }

  const item = await env.FNLSTG_DB.prepare(
    `SELECT id, name, billing_mode, duration_minutes, price_cents, active
     FROM items WHERE id = ? AND type IN ('service','bundle')`,
  )
    .bind(payload.serviceId)
    .first<ItemRow>();

  if (!item || item.active !== 1) {
    return fail(404, 'NOT_FOUND', 'Service not found or inactive');
  }

  const amount =
    item.billing_mode === 'hourly'
      ? item.price_cents
      : item.price_cents;
  const depositAmount = Math.max(100, Math.round(amount * 0.3));
  const startTime = toIsoStart(payload.date, payload.time);
  const endTime = addMinutes(startTime, item.duration_minutes ?? 60);

  const insert = await env.FNLSTG_DB.prepare(
    `INSERT INTO bookings (
      item_id, customer_name, customer_email, customer_phone,
      start_time, end_time, hours_requested, addon_item_ids,
      status, notes, amount_cents, deposit_amount_cents, paid_in_full,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, '[]', 'pending', ?, ?, ?, 0, datetime('now'), datetime('now'))`,
  )
    .bind(
      item.id,
      payload.contact.name,
      payload.contact.email,
      payload.contact.phone,
      startTime,
      endTime,
      payload.contact.notes ?? '',
      depositAmount,
      depositAmount,
    )
    .run();

  const bookingId = Number(insert.meta.last_row_id ?? 0);
  if (!bookingId) {
    return fail(500, 'DB_ERROR', 'Failed to create booking');
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: depositAmount,
          product_data: {
            name: `${item.name} (deposit)`,
          },
        },
      },
    ],
    success_url: `${env.APP_URL}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/book?step=3&service=${item.id}&date=${payload.date}&time=${encodeURIComponent(payload.time)}`,
    customer_email: payload.contact.email,
    metadata: {
      booking_id: String(bookingId),
      item_id: String(item.id),
      charge_mode: 'deposit',
    },
  });

  await env.FNLSTG_DB.prepare(
    'UPDATE bookings SET stripe_session_id = ?, updated_at = datetime(\'now\') WHERE id = ?',
  )
    .bind(session.id, bookingId)
    .run();

  return ok({
    booking_id: bookingId,
    session_id: session.id,
    url: session.url ?? `${env.APP_URL}/booking/success`,
  });
};
