import { z } from 'zod';
import { ok, parseJson, requireAdmin, verifyCsrf } from '../../../lib/http';
import { writeAuditLog } from '../../../lib/auth';
import type { Env } from '../../../lib/types';

const createSchema = z.object({
  template_id: z.number().int().positive().optional(),
  subject_type: z.string().min(1),
  subject_id: z.number().int().positive(),
  assignee_id: z.number().int().positive().optional(),
  title: z.string().min(1).max(500),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
  due_at: z.string().datetime().optional(),
  items: z.array(z.object({
    title: z.string().min(1).max(500),
    position: z.number().int().min(0).default(0),
  })).optional(),
});

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);

  const url = new URL(context.request.url);
  const subjectType = url.searchParams.get('subject_type');
  const subjectId = url.searchParams.get('subject_id');
  const assigneeId = url.searchParams.get('assignee_id');
  const status = url.searchParams.get('status');

  let query = `SELECT t.*, u.name as assignee_name
               FROM tasks t
               LEFT JOIN admin_users u ON t.assignee_id = u.id
               WHERE 1=1`;
  const binds: (string | number)[] = [];
  if (subjectType) { query += ' AND t.subject_type = ?'; binds.push(subjectType); }
  if (subjectId) { query += ' AND t.subject_id = ?'; binds.push(Number(subjectId)); }
  if (assigneeId) { query += ' AND t.assignee_id = ?'; binds.push(Number(assigneeId)); }
  if (status) { query += ' AND t.status = ?'; binds.push(status); }
  query += ' ORDER BY t.created_at DESC';

  const rows = await context.env.LNAPAGES_DB.prepare(query).bind(...binds).all();
  return ok(rows.results);
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const user = await requireAdmin(context);
  await verifyCsrf(context, user);

  const body = await parseJson(request, createSchema);

  const result = await env.LNAPAGES_DB
    .prepare(
      `INSERT INTO tasks (template_id, subject_type, subject_id, assignee_id, title, status, due_at, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .bind(
      body.template_id ?? null,
      body.subject_type,
      body.subject_id,
      body.assignee_id ?? null,
      body.title,
      body.status,
      body.due_at ?? null,
      user.id,
    )
    .run();

  const taskId = Number(result.meta.last_row_id ?? 0);

  // If template_id is provided, clone items from template
  if (body.template_id) {
    const templateItems = await env.LNAPAGES_DB
      .prepare(`SELECT position, title, hint FROM task_template_items WHERE template_id = ? ORDER BY position`)
      .bind(body.template_id)
      .all<{ position: number; title: string; hint: string | null }>();

    if (templateItems.results.length > 0) {
      const stmts = templateItems.results.map((item: { position: number; title: string; hint: string | null }) =>
        env.LNAPAGES_DB
          .prepare(`INSERT INTO task_items (task_id, position, title) VALUES (?, ?, ?)`)
          .bind(taskId, item.position, item.title),
      );
      await env.LNAPAGES_DB.batch(stmts);
    }
  } else if (body.items && body.items.length > 0) {
    const stmts = body.items.map((item) =>
      env.LNAPAGES_DB
        .prepare(`INSERT INTO task_items (task_id, position, title) VALUES (?, ?, ?)`)
        .bind(taskId, item.position, item.title),
    );
    await env.LNAPAGES_DB.batch(stmts);
  }

  await writeAuditLog(env.LNAPAGES_DB, 'task.create', {
    userId: user.id,
    resourceType: 'task',
    resourceId: String(taskId),
    ip: request.headers.get('cf-connecting-ip') ?? undefined,
    ua: request.headers.get('user-agent') ?? undefined,
  });

  return ok({ id: taskId }, 201);
};
