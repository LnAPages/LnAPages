import { z } from 'zod';
import type { PagesFunction } from '@cloudflare/workers-types';
import { bookingUpdateSchema } from '../../../shared/schemas/booking';
import { HttpError, ok, parseJson, requireAdmin } from '../../lib/http';
import type { Env } from '../../lib/types';

const idSchema = z.coerce.number().int().positive();

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const id = idSchema.parse(context.params.id);
  const row = await context.env.LNAPAGES_DB
    .prepare('SELECT * FROM bookings WHERE id = ?')
    .bind(id)
    .first();
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Booking not found');
  return ok(row);
};

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const id = idSchema.parse(context.params.id);
  const payload = await parseJson(context.request, bookingUpdateSchema);

  const addonJson =
    payload.addon_item_ids !== undefined ? JSON.stringify(payload.addon_item_ids) : null;
  const depositPaid =
    payload.deposit_paid !== undefined ? (payload.deposit_paid ? 1 : 0) : null;

  await context.env.LNAPAGES_DB
    .prepare(
      `UPDATE bookings
         SET item_id               = COALESCE(?, item_id),
             customer_name         = COALESCE(?, customer_name),
             customer_email        = COALESCE(?, customer_email),
             customer_phone        = COALESCE(?, customer_phone),
             start_time            = COALESCE(?, start_time),
             end_time              = COALESCE(?, end_time),
             hours_requested       = COALESCE(?, hours_requested),
             addon_item_ids        = COALESCE(?, addon_item_ids),
             deposit_paid          = COALESCE(?, deposit_paid),
             status                = COALESCE(?, status),
             notes                 = COALESCE(?, notes),
             stripe_session_id     = COALESCE(?, stripe_session_id),
             stripe_payment_intent = COALESCE(?, stripe_payment_intent),
             amount_cents          = COALESCE(?, amount_cents),
             updated_at            = datetime('now')
         WHERE id = ?`,
    )
    .bind(
      payload.item_id ?? null,
      payload.customer_name ?? null,
      payload.customer_email ?? null,
      payload.customer_phone ?? null,
      payload.start_time ?? null,
      payload.end_time ?? null,
      payload.hours_requested ?? null,
      addonJson,
      depositPaid,
      payload.status ?? null,
      payload.notes ?? null,
      payload.stripe_session_id ?? null,
      payload.stripe_payment_intent ?? null,
      payload.amount_cents ?? null,
      id,
    )
    .run();

  const updated = await context.env.LNAPAGES_DB
    .prepare('SELECT * FROM bookings WHERE id = ?')
    .bind(id)
    .first();
  return ok(updated);
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const id = idSchema.parse(context.params.id);
  await context.env.LNAPAGES_DB
    .prepare('DELETE FROM bookings WHERE id = ?')
    .bind(id)
    .run();
  return ok({ id });
};
