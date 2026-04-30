import { HttpError, ok, requireAdmin } from '../../../lib/http';
import type { Env } from '../../../lib/types';

interface EmployeeRow {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  invited_at: string | null;
  last_login_at: string | null;
  created_at: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await requireAdmin(context);
  if (user.role !== 'owner' && user.role !== 'admin') {
    throw new HttpError(403, 'FORBIDDEN', 'Insufficient permissions');
  }

  const rows = await context.env.LNAPAGES_DB
    .prepare(
      `SELECT id, email, name, role, status, invited_at, last_login_at, created_at
       FROM admin_users
       WHERE status != 'deleted'
       ORDER BY created_at DESC`,
    )
    .all<EmployeeRow>();

  return ok(rows.results);
};
