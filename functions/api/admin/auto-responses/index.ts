import { z } from 'zod';
import { ok, parseJson, requireAdmin, verifyCsrf } from '../../../lib/http';
import { writeAuditLog } from '../../../lib/auth';
import type { Env } from '../../../lib/types';

const createSchema = z.object({
  trigger_event: z.string().min(1).max(100),
  scope: z.enum(['global', 'service', 'product']).default('global'),
  scope_ref_id: z.number().int().positive().optional(),
  channel: z.enum(['email', 'sms']).default('email'),
  subject: z.string().max(500).optional(),
  body_text: z.string().min(1),
  body_html: z.string().optional(),
  active: z.boolean().default(true),
});

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);

  const url = new URL(context.request.url);
  const triggerEvent = url.searchParams.get('trigger_event');
  const scope = url.searchParams.get('scope');

  let query = `SELECT id, trigger_event, scope, scope_ref_id, channel, subject, active, created_at, updated_at
               FROM auto_response_templates WHERE 1=1`;
  const binds: (string | number)[] = [];
  if (triggerEvent) { query += ' AND trigger_event = ?'; binds.push(triggerEvent); }
  if (scope) { query += ' AND scope = ?'; binds.push(scope); }
  query += ' ORDER BY trigger_event, scope';

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
      `INSERT INTO auto_response_templates
         (trigger_event, scope, scope_ref_id, channel, subject, body_text, body_html, active, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    )
    .bind(
      body.trigger_event,
      body.scope,
      body.scope_ref_id ?? null,
      body.channel,
      body.subject ?? null,
      body.body_text,
      body.body_html ?? null,
      body.active ? 1 : 0,
      user.id,
    )
    .run();

  const id = Number(result.meta.last_row_id ?? 0);

  await writeAuditLog(env.LNAPAGES_DB, 'auto_response.create', {
    userId: user.id,
    resourceType: 'auto_response_template',
    resourceId: String(id),
    ip: request.headers.get('cf-connecting-ip') ?? undefined,
    ua: request.headers.get('user-agent') ?? undefined,
  });

  return ok({ id }, 201);
};
