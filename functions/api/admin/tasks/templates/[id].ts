import { z } from 'zod';
import { HttpError, ok, parseJson, requireAdmin, verifyCsrf } from '../../../../lib/http';
import { writeAuditLog } from '../../../../lib/auth';
import type { Env } from '../../../../lib/types';

const itemSchema = z.object({
  title: z.string().min(1).max(500),
  hint: z.string().max(1000).optional(),
  required: z.boolean().default(true),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  scope: z.enum(['service', 'product', 'global']).optional(),
  scope_ref_id: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
  items: z.array(itemSchema).optional(),
});

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);

  const id = Number(context.params['id']);
  if (!id) throw new HttpError(400, 'BAD_REQUEST', 'Invalid id');

  const template = await context.env.LNAPAGES_DB
    .prepare(`SELECT * FROM task_templates WHERE id = ?`)
    .bind(id)
    .first();
  if (!template) throw new HttpError(404, 'NOT_FOUND', 'Template not found');

  const items = await context.env.LNAPAGES_DB
    .prepare(`SELECT id, position, title, hint, required FROM task_template_items WHERE template_id = ? ORDER BY position`)
    .bind(id)
    .all();

  return ok({ ...template, items: items.results });
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
  if (body.name !== undefined) { setClauses.push('name = ?'); binds.push(body.name); }
  if (body.description !== undefined) { setClauses.push('description = ?'); binds.push(body.description); }
  if (body.scope !== undefined) { setClauses.push('scope = ?'); binds.push(body.scope); }
  if (body.scope_ref_id !== undefined) { setClauses.push('scope_ref_id = ?'); binds.push(body.scope_ref_id); }
  if (body.active !== undefined) { setClauses.push('active = ?'); binds.push(body.active ? 1 : 0); }
  binds.push(id);

  await env.LNAPAGES_DB.prepare(`UPDATE task_templates SET ${setClauses.join(', ')} WHERE id = ?`).bind(...binds).run();

  if (body.items !== undefined) {
    await env.LNAPAGES_DB.prepare(`DELETE FROM task_template_items WHERE template_id = ?`).bind(id).run();
    if (body.items.length > 0) {
      const stmts = body.items.map((item, i) =>
        env.LNAPAGES_DB
          .prepare(`INSERT INTO task_template_items (template_id, position, title, hint, required) VALUES (?, ?, ?, ?, ?)`)
          .bind(id, i, item.title, item.hint ?? null, item.required ? 1 : 0),
      );
      await env.LNAPAGES_DB.batch(stmts);
    }
  }

  await writeAuditLog(env.LNAPAGES_DB, 'task_template.update', {
    userId: user.id,
    resourceType: 'task_template',
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

  await env.LNAPAGES_DB.prepare(`UPDATE task_templates SET active = 0, updated_at = datetime('now') WHERE id = ?`).bind(id).run();

  await writeAuditLog(env.LNAPAGES_DB, 'task_template.delete', {
    userId: user.id,
    resourceType: 'task_template',
    resourceId: String(id),
    ip: request.headers.get('cf-connecting-ip') ?? undefined,
    ua: request.headers.get('user-agent') ?? undefined,
  });

  return ok({ deleted: true });
};
