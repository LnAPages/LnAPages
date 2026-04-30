import { z } from 'zod';
import { HttpError, ok, parseJson, requireAdmin, verifyCsrf } from '../../../lib/http';
import { writeAuditLog } from '../../../lib/auth';
import type { Env } from '../../../lib/types';

const updateSchema = z.object({
  trigger_event: z.string().min(1).max(100).optional(),
  scope: z.enum(['global', 'service', 'product']).optional(),
  scope_ref_id: z.number().int().positive().nullable().optional(),
  channel: z.enum(['email', 'sms']).optional(),
  subject: z.string().max(500).nullable().optional(),
  body_text: z.string().min(1).optional(),
  body_html: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);

  const id = Number(context.params['id']);
  if (!id) throw new HttpError(400, 'BAD_REQUEST', 'Invalid id');

  const row = await context.env.LNAPAGES_DB
    .prepare(`SELECT * FROM auto_response_templates WHERE id = ?`)
    .bind(id)
    .first();
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Auto-response template not found');

  return ok(row);
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
    ['trigger_event', body.trigger_event],
    ['scope', body.scope],
    ['scope_ref_id', body.scope_ref_id],
    ['channel', body.channel],
    ['subject', body.subject],
    ['body_text', body.body_text],
    ['body_html', body.body_html],
  ];
  for (const [col, val] of fields) {
    if (val !== undefined) {
      setClauses.push(`${col} = ?`);
      binds.push(val as string | number | null);
    }
  }
  if (body.active !== undefined) {
    setClauses.push('active = ?');
    binds.push(body.active ? 1 : 0);
  }
  binds.push(id);

  await env.LNAPAGES_DB.prepare(`UPDATE auto_response_templates SET ${setClauses.join(', ')} WHERE id = ?`).bind(...binds).run();

  await writeAuditLog(env.LNAPAGES_DB, 'auto_response.update', {
    userId: user.id,
    resourceType: 'auto_response_template',
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

  await env.LNAPAGES_DB.prepare(`DELETE FROM auto_response_templates WHERE id = ?`).bind(id).run();

  await writeAuditLog(env.LNAPAGES_DB, 'auto_response.delete', {
    userId: user.id,
    resourceType: 'auto_response_template',
    resourceId: String(id),
    ip: request.headers.get('cf-connecting-ip') ?? undefined,
    ua: request.headers.get('user-agent') ?? undefined,
  });

  return ok({ deleted: true });
};
