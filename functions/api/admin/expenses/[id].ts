import { z } from 'zod';
import { HttpError, ok, parseJson, requireAdmin, verifyCsrf } from '../../../lib/http';
import { writeAuditLog } from '../../../lib/auth';
import type { Env } from '../../../lib/types';

const updateSchema = z.object({
  category_id: z.number().int().positive().nullable().optional(),
  vendor: z.string().max(200).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  amount_cents: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  incurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  payment_method: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);

  const id = Number(context.params['id']);
  if (!id) throw new HttpError(400, 'BAD_REQUEST', 'Invalid id');

  const expense = await context.env.LNAPAGES_DB
    .prepare(
      `SELECT e.*, ec.name as category_name, ec.color as category_color
       FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id
       WHERE e.id = ?`,
    )
    .bind(id)
    .first();
  if (!expense) throw new HttpError(404, 'NOT_FOUND', 'Expense not found');

  const attachments = await context.env.LNAPAGES_DB
    .prepare(`SELECT id, r2_key, mime_type, file_name, size_bytes, created_at FROM expense_attachments WHERE expense_id = ?`)
    .bind(id)
    .all();

  return ok({ ...expense, attachments: attachments.results });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const user = await requireAdmin(context);
  await verifyCsrf(context, user);

  const id = Number(context.params['id']);
  if (!id) throw new HttpError(400, 'BAD_REQUEST', 'Invalid id');

  const body = await parseJson(request, updateSchema);

  const setClauses: string[] = ["updated_at = datetime('now')"];
  const binds: (string | number | null)[] = [];
  const fields: Array<[string, unknown]> = [
    ['category_id', body.category_id],
    ['vendor', body.vendor],
    ['description', body.description],
    ['amount_cents', body.amount_cents],
    ['currency', body.currency],
    ['incurred_on', body.incurred_on],
    ['payment_method', body.payment_method],
    ['notes', body.notes],
  ];
  for (const [col, val] of fields) {
    if (val !== undefined) {
      setClauses.push(`${col} = ?`);
      binds.push(val as string | number | null);
    }
  }
  binds.push(id);

  await env.LNAPAGES_DB.prepare(`UPDATE expenses SET ${setClauses.join(', ')} WHERE id = ?`).bind(...binds).run();

  await writeAuditLog(env.LNAPAGES_DB, 'expense.update', {
    userId: user.id,
    resourceType: 'expense',
    resourceId: String(id),
    ip: request.headers.get('cf-connecting-ip') ?? undefined,
    ua: request.headers.get('user-agent') ?? undefined,
  });

  return ok({ updated: true });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const user = await requireAdmin(context);
  await verifyCsrf(context, user);

  const id = Number(context.params['id']);
  if (!id) throw new HttpError(400, 'BAD_REQUEST', 'Invalid id');

  await env.LNAPAGES_DB.prepare(`DELETE FROM expenses WHERE id = ?`).bind(id).run();

  await writeAuditLog(env.LNAPAGES_DB, 'expense.delete', {
    userId: user.id,
    resourceType: 'expense',
    resourceId: String(id),
    ip: request.headers.get('cf-connecting-ip') ?? undefined,
    ua: request.headers.get('user-agent') ?? undefined,
  });

  return ok({ deleted: true });
};
