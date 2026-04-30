import { z } from 'zod';
import { HttpError, ok, parseJson, requireAdmin, verifyCsrf } from '../../../lib/http';
import { writeAuditLog } from '../../../lib/auth';
import type { Env } from '../../../lib/types';

const updateSchema = z.object({
  assignee_id: z.number().int().positive().nullable().optional(),
  title: z.string().min(1).max(500).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  due_at: z.string().datetime().nullable().optional(),
});

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);

  const id = Number(context.params['id']);
  if (!id) throw new HttpError(400, 'BAD_REQUEST', 'Invalid id');

  const task = await context.env.LNAPAGES_DB
    .prepare(
      `SELECT t.*, u.name as assignee_name
       FROM tasks t LEFT JOIN admin_users u ON t.assignee_id = u.id
       WHERE t.id = ?`,
    )
    .bind(id)
    .first();
  if (!task) throw new HttpError(404, 'NOT_FOUND', 'Task not found');

  const items = await context.env.LNAPAGES_DB
    .prepare(`SELECT ti.*, u.name as done_by_name FROM task_items ti LEFT JOIN admin_users u ON ti.done_by = u.id WHERE ti.task_id = ? ORDER BY ti.position`)
    .bind(id)
    .all();

  return ok({ ...task, items: items.results });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const user = await requireAdmin(context);
  await verifyCsrf(context, user);

  const id = Number(context.params['id']);
  if (!id) throw new HttpError(400, 'BAD_REQUEST', 'Invalid id');

  const body = await parseJson(request, updateSchema);

  const setClauses: string[] = [];
  const binds: (string | number | null)[] = [];
  if (body.assignee_id !== undefined) { setClauses.push('assignee_id = ?'); binds.push(body.assignee_id); }
  if (body.title !== undefined) { setClauses.push('title = ?'); binds.push(body.title); }
  if (body.status !== undefined) {
    setClauses.push('status = ?');
    binds.push(body.status);
    if (body.status === 'completed') {
      setClauses.push("completed_at = datetime('now')");
    }
  }
  if (body.due_at !== undefined) { setClauses.push('due_at = ?'); binds.push(body.due_at); }

  if (setClauses.length === 0) throw new HttpError(400, 'BAD_REQUEST', 'Nothing to update');
  binds.push(id);

  await env.LNAPAGES_DB
    .prepare(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`)
    .bind(...binds)
    .run();

  await writeAuditLog(env.LNAPAGES_DB, 'task.update', {
    userId: user.id,
    resourceType: 'task',
    resourceId: String(id),
    ip: request.headers.get('cf-connecting-ip') ?? undefined,
    ua: request.headers.get('user-agent') ?? undefined,
  });

  return ok({ updated: true });
};
