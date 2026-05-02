import type { PagesFunction } from '@cloudflare/workers-types';
import { bookingCreateSchema } from '../../../shared/schemas/booking';
import { ok, fail, parseJson, requireAdmin, HttpError } from '../../lib/http';
import type { Env } from '../../lib/types';
import { createCalendarEvent } from '../../lib/googleCalendar';

/** Extracts a message string from an unknown error, capped at 1000 characters. */
function truncateError(err: unknown): string {
  return String(err instanceof Error ? err.message : err).slice(0, 1000);
}

type AddonRow = { id: number; name: string; price_cents: number; active: number };

type ItemRow = {
  id: number;
  type: 'service' | 'product';
  slug: string;
  name: string;
  billing_mode: 'one_time' | 'hourly' | 'monthly_retainer';
  duration_minutes: number | null;
  price_cents: number;
  deposit_cents: number;
  active: number;
};

/**
 * Computes the booking subtotal (in cents) from the item's billing mode and,
 * when applicable, the requested hours. Add-on totals are added separately.
 *
 *   one_time         -> item.price_cents
 *   hourly           -> item.price_cents * hours_requested
 *   monthly_retainer -> item.price_cents (first invoice; recurrence handled by Stripe)
 */
function priceForItem(item: ItemRow, hoursRequested: number | null | undefined): number {
  switch (item.billing_mode) {
    case 'hourly': {
      const hours = hoursRequested ?? 0;
      if (hours <= 0) return 0;
      return Math.round(item.price_cents * hours);
    }
    case 'monthly_retainer':
    case 'one_time':
    default:
      return item.price_cents;
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    await requireAdmin(context);
    const { results } = await context.env.LNAPAGES_DB
      .prepare('SELECT * FROM bookings ORDER BY start_time DESC')
      .all();
    return ok(results);
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.code, err.message);
    console.error('[GET /api/bookings]', err);
    return fail(500, 'internal_error', 'Failed to list bookings');
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const payload = await parseJson(request, bookingCreateSchema);

    // 1. Load the primary item.
    const item = await env.LNAPAGES_DB
      .prepare('SELECT id, type, slug, name, billing_mode, duration_minutes, price_cents, deposit_cents, active FROM items WHERE id = ?')
      .bind(payload.item_id)
      .first<ItemRow>();

    if (!item) {
      return fail(400, 'invalid_item', 'Booking references an item that does not exist');
    }
    if (item.active !== 1) {
      return fail(400, 'inactive_item', 'This item is not currently bookable');
    }

    // 2. Hourly items require hours_requested > 0.
    if (item.billing_mode === 'hourly') {
      const hours = payload.hours_requested ?? 0;
      if (hours <= 0) {
        return fail(400, 'hours_required', 'hours_requested must be greater than 0 for hourly items');
      }
    }

    // 3. Validate add-ons exist + are active.
    const addonIds = payload.addon_item_ids ?? [];
    let addonTotal = 0;
    const addonNames: string[] = [];
    if (addonIds.length > 0) {
      const placeholders = addonIds.map(() => '?').join(',');
      const { results: addons } = await env.LNAPAGES_DB
        .prepare(`SELECT id, name, price_cents, active FROM items WHERE id IN (${placeholders})`)
        .bind(...addonIds)
        .all<AddonRow>();

      const foundIds = new Set((addons ?? []).map((a: AddonRow) => a.id));
      const missing = addonIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        return fail(400, 'invalid_addon', `Add-on item(s) not found: ${missing.join(', ')}`);
      }
      const inactive = (addons ?? []).filter((a: AddonRow) => a.active !== 1).map((a: AddonRow) => a.id);
      if (inactive.length > 0) {
        return fail(400, 'inactive_addon', `Add-on item(s) not active: ${inactive.join(', ')}`);
      }
      addonTotal = (addons ?? []).reduce((sum: number, a: AddonRow) => sum + a.price_cents, 0);
      addonNames.push(...(addons ?? []).map((a: AddonRow) => a.name));
    }

    // 4. Compute totals and enforce deposit policy.
    const baseTotal = priceForItem(item, payload.hours_requested ?? null);
    const amountCents = baseTotal + addonTotal;

    if (item.deposit_cents > 0 && !payload.deposit_paid) {
      return fail(
        402,
        'deposit_required',
        `A deposit of $${(item.deposit_cents / 100).toFixed(2)} is required before booking ${item.name}.`,
      );
    }

    // 5. Insert the booking.
    const status = 'pending';
    const addonJson = JSON.stringify(addonIds);

    const result = await env.LNAPAGES_DB
      .prepare(
        `INSERT INTO bookings (
          item_id, customer_name, customer_email, customer_phone,
          start_time, end_time, hours_requested, addon_item_ids, deposit_paid,
          status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      )
      .bind(
        payload.item_id,
        payload.customer_name,
        payload.customer_email,
        payload.customer_phone,
        payload.start_time,
        payload.end_time ?? null,
        payload.hours_requested ?? null,
        addonJson,
        payload.deposit_paid ? 1 : 0,
        status,
        payload.notes ?? '',
      )
      .run();

    const bookingId = Number(result.meta.last_row_id ?? 0);

    // 6. Best-effort: create a Google Calendar event.
    //    Never drop the booking if Calendar fails — the booking is the source
    //    of truth; the calendar is a downstream side-effect.
    if (env.GOOGLE_CALENDAR_ID && env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      try {
        const addonLine = addonNames.length > 0
          ? `\nAdd-ons: ${addonNames.join(', ')}`
          : '';
        const description =
          `Customer: ${payload.customer_name}` +
          `\nEmail: ${payload.customer_email}` +
          `\nPhone: ${payload.customer_phone}` +
          `\nService: ${item.name}` +
          addonLine +
          (payload.notes ? `\nNotes: ${payload.notes}` : '');

        const tz = env.GOOGLE_CALENDAR_TIMEZONE ?? 'America/Los_Angeles';

        const event = await createCalendarEvent(env, {
          summary: `${item.name} — ${payload.customer_name}`,
          description,
          start: { dateTime: payload.start_time, timeZone: tz },
          end: {
            dateTime: payload.end_time ?? payload.start_time,
            timeZone: tz,
          },
          extendedProperties: { private: { bookingId: String(bookingId) } },
        });

        await env.LNAPAGES_DB
          .prepare(
            `UPDATE bookings
                SET google_event_id = ?,
                    google_calendar_sync_status = 'synced',
                    google_calendar_synced_at = datetime('now')
              WHERE id = ?`,
          )
          .bind(event.id, bookingId)
          .run();
      } catch (err) {
        console.error('[bookings] calendar sync failed', { bookingId, err });
        await env.LNAPAGES_DB
          .prepare(
            `UPDATE bookings
                SET google_calendar_sync_status = 'failed',
                    google_calendar_sync_error = ?
              WHERE id = ?`,
          )
          .bind(truncateError(err), bookingId)
          .run();
      }
    }

    return ok(
      {
        id: bookingId,
        ...payload,
        status,
        amount_cents: amountCents,
        item: { id: item.id, slug: item.slug, name: item.name, billing_mode: item.billing_mode },
      },
      201,
    );
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.code, err.message);
    console.error('[POST /api/bookings]', err);
    return fail(500, 'internal_error', 'Failed to create booking');
  }
};
