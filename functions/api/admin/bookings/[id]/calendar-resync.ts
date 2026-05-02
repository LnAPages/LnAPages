import { z } from 'zod';
import type { PagesFunction } from '@cloudflare/workers-types';
import { ok, fail, requireAdmin, HttpError } from '../../../../lib/http';
import type { Env } from '../../../../lib/types';
import { createCalendarEvent } from '../../../../lib/googleCalendar';

const idSchema = z.coerce.number().int().positive();

type BookingRow = {
  id: number;
  item_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  start_time: string;
  end_time: string | null;
  notes: string | null;
  google_event_id: string | null;
  google_calendar_sync_status: string | null;
};

type ItemRow = { name: string };

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    await requireAdmin(context);

    const id = idSchema.parse(context.params.id);

    const booking = await context.env.LNAPAGES_DB
      .prepare(
        `SELECT id, item_id, customer_name, customer_email, customer_phone,
                start_time, end_time, notes, google_event_id, google_calendar_sync_status
           FROM bookings WHERE id = ?`,
      )
      .bind(id)
      .first<BookingRow>();

    if (!booking) {
      return fail(404, 'NOT_FOUND', 'Booking not found');
    }

    if (!context.env.GOOGLE_CALENDAR_ID || !context.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      return fail(503, 'CALENDAR_NOT_CONFIGURED', 'Google Calendar integration is not configured');
    }

    const item = await context.env.LNAPAGES_DB
      .prepare('SELECT name FROM items WHERE id = ?')
      .bind(booking.item_id)
      .first<ItemRow>();

    const serviceName = item?.name ?? `Item #${booking.item_id}`;
    const tz = context.env.GOOGLE_CALENDAR_TIMEZONE ?? 'America/Los_Angeles';

    const description =
      `Customer: ${booking.customer_name}` +
      `\nEmail: ${booking.customer_email}` +
      `\nPhone: ${booking.customer_phone}` +
      `\nService: ${serviceName}` +
      (booking.notes ? `\nNotes: ${booking.notes}` : '');

    try {
      const event = await createCalendarEvent(context.env, {
        summary: `${serviceName} — ${booking.customer_name}`,
        description,
        start: { dateTime: booking.start_time, timeZone: tz },
        end: { dateTime: booking.end_time ?? booking.start_time, timeZone: tz },
        extendedProperties: { private: { bookingId: String(booking.id) } },
      });

      await context.env.LNAPAGES_DB
        .prepare(
          `UPDATE bookings
              SET google_event_id = ?,
                  google_calendar_sync_status = 'synced',
                  google_calendar_sync_error = NULL,
                  google_calendar_synced_at = datetime('now')
            WHERE id = ?`,
        )
        .bind(event.id, booking.id)
        .run();

      return ok({ synced: true, eventId: event.id, htmlLink: event.htmlLink });
    } catch (err) {
      const message = String(err instanceof Error ? err.message : err).slice(0, 1000);

      await context.env.LNAPAGES_DB
        .prepare(
          `UPDATE bookings
              SET google_calendar_sync_status = 'failed',
                  google_calendar_sync_error = ?
            WHERE id = ?`,
        )
        .bind(message, booking.id)
        .run();

      console.error('[admin/bookings] calendar resync failed', { bookingId: booking.id, err });
      return fail(502, 'CALENDAR_SYNC_FAILED', `Calendar sync failed: ${message}`);
    }
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.code, err.message);
    console.error('[admin/bookings/calendar-resync]', err);
    return fail(500, 'internal_error', 'Failed to resync calendar event');
  }
};
