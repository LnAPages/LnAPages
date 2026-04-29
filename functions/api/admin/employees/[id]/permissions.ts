import { z } from 'zod';
import { HttpError, ok, parseJson, requireAdmin, verifyCsrf } from '../../../../lib/http';
import { writeAuditLog } from '../../../../lib/auth';
import type { Env } from '../../../../lib/types';

const schema = z.object({
  permissions: z.array(
    z.object({
      panel_key: z.string().min(1),
      can_view: z.boolean(),
      can_edit: z.boolean(),
    }),
  ),
});

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const user = await requireAdmin(context);
  await verifyCsrf(context, user);

  if (user.role !== 'owner') {
    throw new HttpError(403, 'FORBIDDEN', 'Only owners can manage permissions');
  }

  const targetId = Number(context.params['id']);
  if (!targetId) throw new HttpError(400, 'BAD_REQUEST', 'Invalid employee id');

  const body = await parseJson(request, schema);

  const stmts = body.permissions.map((p) =>
    env.FNLSTG_DB.prepare(
      `INSERT INTO admin_panel_permissions (user_id, panel_key, can_view, can_edit, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, panel_key) DO UPDATE SET
         can_view = excluded.can_view,
         can_edit = excluded.can_edit,
         updated_at = excluded.updated_at`,
    ).bind(targetId, p.panel_key, p.can_view ? 1 : 0, p.can_edit ? 1 : 0),
  );

  if (stmts.length > 0) {
    await env.FNLSTG_DB.batch(stmts);
  }

  await writeAuditLog(env.FNLSTG_DB, 'employee.permissions_updated', {
    userId: user.id,
    resourceType: 'admin_user',
    resourceId: String(targetId),
    metadata: { permissions: body.permissions },
    ip: request.headers.get('cf-connecting-ip') ?? undefined,
    ua: request.headers.get('user-agent') ?? undefined,
  });

  return ok({ updated: true });
};
