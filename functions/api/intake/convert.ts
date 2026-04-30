import { z } from 'zod';
import type { PagesFunction } from '@cloudflare/workers-types';
import { ok, fail, parseJson, requireAdmin, HttpError } from '../../lib/http';
import type { Env } from '../../lib/types';

/**
 * Admin-only: convert an intake into a booking.
 *
 * Pre-conditions
 *   - intake exists, has not already been converted (intake.booking_id IS NULL)
 *   - referenced item is an active service/bundle
 *
 * Side-effects (single best-effort sequence; no transaction since D1 batches
 * are limited and we explicitly tolerate partial state by being idempotent)
 *   1. INSERT a row into bookings using the intake's customer info, the
 *      service's billing mode + live price, and the admin-supplied schedule.
 *   2. UPDATE intakes.booking_id = newBooking.id (this is the canonical
 *      "converted" marker; checked first on the next call for idempotency).
 *   3. If the intake (or a contact lookup by email_lower / phone_e164) yields
 *      a contact_id, write it onto the booking and bump the contact's stage
 *      to 'booked' + last_activity_at = now.
 *
 * Deferred (tracked in PR #86 description):
 *   - Activity timeline events (intake_converted, booking_created)
 *   - 10-second undo toast that rolls everything back
 */

type IntakeRow = {
  id: number;
  name: string;
  email: string;
  phone: string;
  message: string | null;
  contact_id: number | null;
  booking_id: number | null;
};

type ItemRow = {
  id: number;
  type: 'service' | 'bundle' | 'product';
  name: string;
  slug: string;
  billing_mode: 'one_time' | 'hourly' | 'monthly_retainer';
  duration_minutes: number | null;
  price_cents: number;
  deposit_cents: number;
  active: number;
};

const convertSchema = z.object({
  intake_id: z.number().int().positive(),
  item_id: z.number().int().positive(),
  start_time: z.string().min(1, 'start_time is required'),
  end_time: z.string().optional().nullable(),
  hours_requested: z.number().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

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

function normalizeEmail(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = String(input).trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhoneE164(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D+/g, '');
  if (digits.length === 0) return null;
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return '+' + digits;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    await requireAdmin(context);
    const payload = await parseJson(context.request, convertSchema);
    const db = context.env.LNAPAGES_DB;

    // 1. Load the intake. Tolerate older rows where contact_id / booking_id
    //    columns may not yet have been populated — they default to NULL.
    let intake: IntakeRow | null = null;
    try {
      intake = await db
        .prepare(
          'SELECT id, name, email, phone, message, contact_id, booking_id FROM intakes WHERE id = ?',
        )
        .bind(payload.intake_id)
        .first<IntakeRow>();
    } catch {
      // contact_id may not exist yet on older deployments; fall back without it.
      const fallback = await db
        .prepare('SELECT id, name, email, phone, message, booking_id FROM intakes WHERE id = ?')
        .bind(payload.intake_id)
        .first<Omit<IntakeRow, 'contact_id'>>();
      intake = fallback ? { ...fallback, contact_id: null } : null;
    }
    if (!intake) return fail(404, 'intake_not_found', 'Intake does not exist');

    // 2. Idempotency: if already converted, return the existing booking.
    if (intake.booking_id != null) {
      return ok(
        {
          intake_id: intake.id,
          booking_id: intake.booking_id,
          contact_id: intake.contact_id,
          already_converted: true,
        },
        200,
      );
    }

    // 3. Load the service. Must exist, be a service/bundle, and be active.
    const item = await db
      .prepare(
        'SELECT id, type, name, slug, billing_mode, duration_minutes, price_cents, deposit_cents, active FROM items WHERE id = ?',
      )
      .bind(payload.item_id)
      .first<ItemRow>();
    if (!item) return fail(400, 'invalid_item', 'Service does not exist');
    if (item.type !== 'service' && item.type !== 'bundle') {
      return fail(400, 'invalid_item_type', 'Selected item is not a bookable service');
    }
    if (item.active !== 1) {
      return fail(400, 'inactive_item', 'Selected service is not currently bookable');
    }
    if (item.billing_mode === 'hourly' && (payload.hours_requested ?? 0) <= 0) {
      return fail(400, 'hours_required', 'Hourly services require hours_requested > 0');
    }

    const baseTotal = priceForItem(item, payload.hours_requested ?? null);

    // 4. Resolve the contact link. Prefer the intake's existing contact_id,
    //    otherwise look up by normalized email or phone. Don't auto-create
    //    here — that's the intake POST's job (PR #82). If no contact exists
    //    yet, the booking is created without a contact link and the operator
    //    can attach one later.
    let contactId: number | null = intake.contact_id ?? null;
    if (contactId == null) {
      const emailLower = normalizeEmail(intake.email);
      const phoneE164 = normalizePhoneE164(intake.phone);
      try {
        if (emailLower) {
          const hit = await db
            .prepare('SELECT id FROM contacts WHERE email_lower = ? LIMIT 1')
            .bind(emailLower)
            .first<{ id: number }>();
          if (hit) contactId = hit.id;
        }
        if (contactId == null && phoneE164) {
          const hit = await db
            .prepare('SELECT id FROM contacts WHERE phone_e164 = ? LIMIT 1')
            .bind(phoneE164)
            .first<{ id: number }>();
          if (hit) contactId = hit.id;
        }
      } catch {
        // contacts table may not exist on environments that haven't run 0017 yet.
        contactId = null;
      }
    }

    // 5. Insert the booking. Mirrors the public POST /api/bookings shape so
    //    downstream views (admin Bookings, payments) can render this row
    //    without a special case. status='pending' to match self-serve.
    const status = 'pending';
    const addonJson = JSON.stringify([]);
    let bookingId: number | null = null;
    try {
      const result = await db
        .prepare(
          `INSERT INTO bookings (
             item_id, customer_name, customer_email, customer_phone,
             start_time, end_time, hours_requested, addon_item_ids, deposit_paid,
             status, notes, contact_id, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        )
        .bind(
          item.id,
          intake.name,
          intake.email,
          intake.phone,
          payload.start_time,
          payload.end_time ?? null,
          payload.hours_requested ?? null,
          addonJson,
          0,
          status,
          payload.notes ?? intake.message ?? '',
          contactId,
        )
        .run();
      bookingId = Number(result.meta.last_row_id ?? 0) || null;
    } catch {
      // contact_id column may not exist on older bookings tables; retry without it.
      const result = await db
        .prepare(
          `INSERT INTO bookings (
             item_id, customer_name, customer_email, customer_phone,
             start_time, end_time, hours_requested, addon_item_ids, deposit_paid,
             status, notes, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        )
        .bind(
          item.id,
          intake.name,
          intake.email,
          intake.phone,
          payload.start_time,
          payload.end_time ?? null,
          payload.hours_requested ?? null,
          addonJson,
          0,
          status,
          payload.notes ?? intake.message ?? '',
        )
        .run();
      bookingId = Number(result.meta.last_row_id ?? 0) || null;
    }
    if (bookingId == null) {
      return fail(500, 'booking_insert_failed', 'Could not create booking row');
    }

    // 6. Mark the intake as converted by stamping booking_id. This is the
    //    flag the UI watches for to swap Convert -> View booking.
    await db
      .prepare('UPDATE intakes SET booking_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(bookingId, intake.id)
      .run();

    // 7. Bump the contact's stage to 'booked' + activity timestamp.
    if (contactId != null) {
      try {
        await db
          .prepare(
            "UPDATE contacts SET stage = 'booked', last_activity_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
          )
          .bind(contactId)
          .run();
      } catch {
        // Non-fatal: the conversion still succeeded even if the CRM update fails.
      }
    }

    return ok(
      {
        intake_id: intake.id,
        booking_id: bookingId,
        contact_id: contactId,
        amount_cents: baseTotal,
        item: { id: item.id, slug: item.slug, name: item.name, billing_mode: item.billing_mode },
      },
      201,
    );
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.code, err.message);
    console.error('[POST /api/intake/convert]', err);
    return fail(500, 'internal_error', 'Failed to convert intake');
  }
};
