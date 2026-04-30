import { z } from 'zod';
import type { PagesFunction } from '@cloudflare/workers-types';
import { ok, fail, requireAdmin, HttpError } from '../../../lib/http';
import type { Env } from '../../../lib/types';

const idSchema = z.coerce.number().int().positive();

// ── GET /api/contacts/:id/activity ──────────────────────────────────────────
// Returns a merged, newest-first feed of intakes, bookings, and invoices
// linked to this contact.

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    await requireAdmin(context);
    const id = idSchema.parse(context.params.id);

    // Check contact exists.
    const contact = await context.env.LNAPAGES_DB
      .prepare('SELECT id, name, email, phone FROM contacts WHERE id = ?')
      .bind(id)
      .first<{ id: number; name: string; email: string | null; phone: string | null }>();
    if (!contact) return fail(404, 'NOT_FOUND', 'Contact not found');

    const db = context.env.LNAPAGES_DB;

    // 1. Intakes linked by FK.
    const { results: intakes } = await db
      .prepare(`SELECT id, name, email, project_type, status, created_at
                  FROM intakes WHERE contact_id = ? ORDER BY created_at DESC`)
      .bind(id)
      .all<{ id: number; name: string; email: string; project_type: string; status: string; created_at: string }>();

    // 2. Bookings linked by FK.
    const { results: bookings } = await db
      .prepare(`SELECT id, customer_name, customer_email, status, start_time, amount_cents, created_at
                  FROM bookings WHERE contact_id = ? ORDER BY start_time DESC`)
      .bind(id)
      .all<{ id: number; customer_name: string; customer_email: string; status: string; start_time: string; amount_cents: number | null; created_at: string }>();

    // 3. Invoices linked by booking's contact (no direct FK yet).
    //    Use email as secondary key if available.
    type InvoiceRow = { id: number; booking_id: number | null; customer_email: string | null; total_cents: number; status: string; issued_at: string };
    let invoices: InvoiceRow[] = [];
    if (contact.email) {
      const { results } = await db
        .prepare(`SELECT id, booking_id, customer_email, total_cents, status, issued_at
                    FROM invoices WHERE lower(customer_email) = ? ORDER BY issued_at DESC`)
        .bind(contact.email.toLowerCase())
        .all<InvoiceRow>();
      invoices = results ?? [];
    }

    // Merge and sort newest first.
    type ActivityEvent = {
      type: 'intake' | 'booking' | 'invoice';
      id: number;
      summary: string;
      status: string;
      timestamp: string;
    };

    const events: ActivityEvent[] = [
      ...(intakes ?? []).map((r: any) => ({
        type: 'intake' as const,
        id: r.id,
        summary: `Intake – ${r.project_type}`,
        status: r.status,
        timestamp: r.created_at,
      })),
      ...(bookings ?? []).map((r: any) => ({
        type: 'booking' as const,
        id: r.id,
        summary: `Booking – ${r.start_time?.slice(0, 10) ?? ''}${r.amount_cents ? ` · $${(r.amount_cents / 100).toFixed(2)}` : ''}`,
        status: r.status,
        timestamp: r.start_time ?? r.created_at,
      })),
      ...invoices.map((r) => ({
        type: 'invoice' as const,
        id: r.id,
        summary: `Invoice – $${(r.total_cents / 100).toFixed(2)}`,
        status: r.status,
        timestamp: r.issued_at,
      })),
    ];

    events.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));

    return ok(events);
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.code, err.message);
    console.error('[GET /api/contacts/:id/activity]', err);
    return fail(500, 'internal_error', 'Failed to load activity');
  }
};
