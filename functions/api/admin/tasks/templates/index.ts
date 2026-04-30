import { z } from 'zod';
import { ok, parseJson, requireAdmin, verifyCsrf } from '../../../../lib/http';
import { writeAuditLog } from '../../../../lib/auth';
import type { Env } from '../../../../lib/types';

const itemSchema = z.object({
  title: z.string().min(1).max(500),
  hint: z.string().max(1000).optional(),
  required: z.boolean().default(true),
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  scope: z.enum(['service', 'product', 'global']).default('service'),
  scope_ref_id: z.number().int().positive().optional(),
  items: z.array(itemSchema).default([]),
});

interface TemplateRow {
  id: number;
  name: string;
  description: string | null;
  scope: string;
  scope_ref_id: number | null;
  active: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);

  const url = new URL(context.request.url);
  const scope = url.searchParams.get('scope');

  let query = `SELECT id, name, description, scope, scope_ref_id, active, created_by, created_at, updated_at
               FROM task_templates WHERE active = 1`;
  const binds: (string | number)[] = [];
  if (scope) { query += ' AND scope = ?'; binds.push(scope); }
  query += ' ORDER BY created_at DESC';

  const rows = await context.env.LNAPAGES_DB.prepare(query).bind(...binds).all<TemplateRow>();
  return ok(rows.results);
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const user = await requireAdmin(context);
  await verifyCsrf(context, user);

  const body = await parseJson(request, createSchema);

  const result = await env.LNAPAGES_DB
    .prepare(
      `INSERT INTO task_templates (name, description, scope, scope_ref_id, active, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`,
    )
    .bind(body.name, body.description ?? null, body.scope, body.scope_ref_id ?? null, user.id)
    .run();

  const templateId = Number(result.meta.last_row_id ?? 0);

  if (body.items.length > 0) {
    const itemStmts = body.items.map((item, i) =>
      env.LNAPAGES_DB
        .prepare(`INSERT INTO task_template_items (template_id, position, title, hint, required) VALUES (?, ?, ?, ?, ?)`)
        .bind(templateId, i, item.title, item.hint ?? null, item.required ? 1 : 0),
    );
    await env.LNAPAGES_DB.batch(itemStmts);
  }

  await writeAuditLog(env.LNAPAGES_DB, 'task_template.create', {
    userId: user.id,
    resourceType: 'task_template',
    resourceId: String(templateId),
    ip: request.headers.get('cf-connecting-ip') ?? undefined,
    ua: request.headers.get('user-agent') ?? undefined,
  });

  return ok({ id: templateId }, 201);
};
