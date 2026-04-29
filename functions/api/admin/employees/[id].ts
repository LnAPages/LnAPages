import { z } from 'zod';
import { HttpError, ok, parseJson, requireAdmin, verifyCsrf } from '../../../lib/http';
import { writeAuditLog } from '../../../lib/auth';
import type { Env } from '../../../lib/types';

interface EmployeeRow {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  invited_at: string | null;
  last_login_at: string | null;
  failed_login_count: number;
  locked_until: string | null;
  created_at: string;
}

interface PermissionRow {
  panel_key: string;
  can_view: number;
  can_edit: number;
}

const updateSchema = z.object({
  role: z.enum(['employee', 'admin', 'owner']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
});

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await requireAdmin(context);
  if (user.role !== 'owner' && user.role !== 'admin') {
    throw new HttpError(403, 'FORBIDDEN', 'Insufficient permissions');
  }

  const targetId = Number(context.params['id']);
  if (!targetId) throw new HttpError(400, 'BAD_REQUEST', 'Invalid employee id');

  const employee = await context.env.FNLSTG_DB
    .prepare(
      `SELECT id, email, name, role, status, invited_at, last_login_at, failed_login_count, locked_until, created_at
       FROM admin_users WHERE id = ?`,
    )
    .bind(targetId)
    .first<EmployeeRow>();

  if (!employee) throw new HttpError(404, 'NOT_FOUND', 'Employee not found');

  const perms = await context.env.FNLSTG_DB
    .prepare(`SELECT panel_key, can_view, can_edit FROM admin_panel_permissions WHERE user_id = ?`)
    .bind(targetId)
    .all<PermissionRow>();

  return ok({ ...employee, permissions: perms.results });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const user = await requireAdmin(context);
  await verifyCsrf(context, user);

  if (user.role !== 'owner') {
    throw new HttpError(403, 'FORBIDDEN', 'Only owners can update employee details');
  }

  const targetId = Number(context.params['id']);
  if (!targetId) throw new HttpError(400, 'BAD_REQUEST', 'Invalid employee id');

  const body = await parseJson(request, updateSchema);
  if (body.role === undefined && body.status === undefined) {
    throw new HttpError(400, 'BAD_REQUEST', 'Nothing to update');
  }

  const setClauses: string[] = [];
  const binds: (string | number)[] = [];
  if (body.role !== undefined) { setClauses.push('role = ?'); binds.push(body.role); }
  if (body.status !== undefined) { setClauses.push('status = ?'); binds.push(body.status); }
  binds.push(targetId);

  await env.FNLSTG_DB
    .prepare(`UPDATE admin_users SET ${setClauses.join(', ')} WHERE id = ?`)
    .bind(...binds)
    .run();

  await writeAuditLog(env.FNLSTG_DB, 'employee.update', {
    userId: user.id,
    resourceType: 'admin_user',
    resourceId: String(targetId),
    metadata: body,
    ip: request.headers.get('cf-connecting-ip') ?? undefined,
    ua: request.headers.get('user-agent') ?? undefined,
  });

  return ok({ updated: true });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const user = await requireAdmin(context);
  await verifyCsrf(context, user);

  if (user.role !== 'owner') {
    throw new HttpError(403, 'FORBIDDEN', 'Only owners can delete employees');
  }

  const targetId = Number(context.params['id']);
  if (!targetId) throw new HttpError(400, 'BAD_REQUEST', 'Invalid employee id');
  if (targetId === user.id) throw new HttpError(400, 'BAD_REQUEST', 'Cannot delete yourself');

  await env.FNLSTG_DB
    .prepare(`UPDATE admin_users SET status = 'deleted' WHERE id = ?`)
    .bind(targetId)
    .run();

  // Revoke active sessions
  await env.FNLSTG_DB
    .prepare(`UPDATE admin_sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL`)
    .bind(targetId)
    .run();

  await writeAuditLog(env.FNLSTG_DB, 'employee.delete', {
    userId: user.id,
    resourceType: 'admin_user',
    resourceId: String(targetId),
    ip: request.headers.get('cf-connecting-ip') ?? undefined,
    ua: request.headers.get('user-agent') ?? undefined,
  });

  return ok({ deleted: true });
};
