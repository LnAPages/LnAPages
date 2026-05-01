import { ok, requireAdmin, verifyCsrf } from '../../../lib/http';
import type { Env } from '../../../lib/types';

// POST /api/admin/expenses/process-recurring
// Processes recurring expense templates that are due today or overdue.
// Call this via a Cloudflare cron Worker, an external scheduler, or manually from the admin.
// The cron Worker should POST to this endpoint with admin credentials once per day.
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const user = await requireAdmin(context);
  await verifyCsrf(context, user);

  const today = new Date().toISOString().slice(0, 10);

  // Find all active recurring templates that are due
  const due = await env.LNAPAGES_DB
    .prepare(
      `SELECT * FROM expenses
       WHERE is_recurring = 1 AND next_occurrence_at IS NOT NULL AND next_occurrence_at <= ?`,
    )
    .bind(today)
    .all<Record<string, unknown>>();

  const created: number[] = [];

  for (const template of (due.results ?? [])) {
    const intervalDays = typeof template.recurring_interval_days === 'number' ? template.recurring_interval_days : 31;

    // Insert a child expense entry
    const result = await env.LNAPAGES_DB
      .prepare(
        `INSERT INTO expenses
           (category_id, vendor, description, amount_cents, currency, incurred_on,
            payment_method, notes, is_recurring, parent_expense_id, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, datetime('now'), datetime('now'))`,
      )
      .bind(
        template.category_id ?? null,
        template.vendor ?? null,
        template.description ?? null,
        template.amount_cents,
        template.currency ?? 'USD',
        today,
        template.payment_method ?? null,
        template.notes ?? null,
        template.id,
        user.id,
      )
      .run();

    created.push(Number(result.meta.last_row_id));

    // Advance next_occurrence_at by interval_days from the scheduled date (not from now)
    // to prevent drift if the cron runs slightly late.
    const scheduledBase = typeof template.next_occurrence_at === 'string' ? template.next_occurrence_at : today;
    const baseDate = new Date(scheduledBase + 'T00:00:00Z');
    const nextDate = new Date(baseDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    const nextOccurrence = nextDate.toISOString().slice(0, 10);

    await env.LNAPAGES_DB
      .prepare(
        `UPDATE expenses SET next_occurrence_at = ?, updated_at = datetime('now') WHERE id = ?`,
      )
      .bind(nextOccurrence, template.id)
      .run();
  }

  return ok({ processed: created.length, created });
};

// GET /api/admin/expenses/process-recurring — preview what would run
export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);

  const today = new Date().toISOString().slice(0, 10);

  const due = await context.env.LNAPAGES_DB
    .prepare(
      `SELECT id, description, vendor, amount_cents, incurred_on, next_occurrence_at, recurring_interval_days
       FROM expenses
       WHERE is_recurring = 1 AND next_occurrence_at IS NOT NULL AND next_occurrence_at <= ?`,
    )
    .bind(today)
    .all();

  return ok({ due: due.results ?? [] });
};
