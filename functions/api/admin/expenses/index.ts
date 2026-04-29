import { z } from 'zod';
import { ok, parseJson, requireAdmin, verifyCsrf } from '../../../lib/http';
import { writeAuditLog } from '../../../lib/auth';
import type { Env } from '../../../lib/types';

const createSchema = z.object({
  category_id: z.number().int().positive().optional(),
  vendor: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  amount_cents: z.number().int().min(0),
  currency: z.string().length(3).default('USD'),
  incurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payment_method: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);

  const url = new URL(context.request.url);
  const categoryId = url.searchParams.get('category_id');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '100'), 500);
  const offset = Number(url.searchParams.get('offset') ?? '0');

  let query = `SELECT e.*, ec.name as category_name, ec.color as category_color
               FROM expenses e
               LEFT JOIN expense_categories ec ON e.category_id = ec.id
               WHERE 1=1`;
  const binds: (string | number)[] = [];
  if (categoryId) { query += ' AND e.category_id = ?'; binds.push(Number(categoryId)); }
  if (from) { query += ' AND e.incurred_on >= ?'; binds.push(from); }
  if (to) { query += ' AND e.incurred_on <= ?'; binds.push(to); }
  query += ' ORDER BY e.incurred_on DESC, e.id DESC LIMIT ? OFFSET ?';
  binds.push(limit, offset);

  const rows = await context.env.FNLSTG_DB.prepare(query).bind(...binds).all();

  // Total for the same filters
  let countQuery = 'SELECT SUM(amount_cents) as total_cents, COUNT(*) as count FROM expenses e WHERE 1=1';
  const countBinds: (string | number)[] = [];
  if (categoryId) { countQuery += ' AND e.category_id = ?'; countBinds.push(Number(categoryId)); }
  if (from) { countQuery += ' AND e.incurred_on >= ?'; countBinds.push(from); }
  if (to) { countQuery += ' AND e.incurred_on <= ?'; countBinds.push(to); }
  const summary = await context.env.FNLSTG_DB.prepare(countQuery).bind(...countBinds).first<{ total_cents: number; count: number }>();

  return ok({ expenses: rows.results, totalCents: summary?.total_cents ?? 0, count: summary?.count ?? 0 });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const user = await requireAdmin(context);
  await verifyCsrf(context, user);

  const body = await parseJson(request, createSchema);

  const result = await env.FNLSTG_DB
    .prepare(
      `INSERT INTO expenses (category_id, vendor, description, amount_cents, currency, incurred_on, payment_method, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    )
    .bind(
      body.category_id ?? null,
      body.vendor ?? null,
      body.description ?? null,
      body.amount_cents,
      body.currency,
      body.incurred_on,
      body.payment_method ?? null,
      body.notes ?? null,
      user.id,
    )
    .run();

  const expenseId = Number(result.meta.last_row_id ?? 0);

  await writeAuditLog(env.FNLSTG_DB, 'expense.create', {
    userId: user.id,
    resourceType: 'expense',
    resourceId: String(expenseId),
    ip: request.headers.get('cf-connecting-ip') ?? undefined,
    ua: request.headers.get('user-agent') ?? undefined,
  });

  return ok({ id: expenseId }, 201);
};
