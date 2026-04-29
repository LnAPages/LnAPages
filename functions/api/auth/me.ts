import { getAdminUser, ok } from '../../lib/http';
import type { Env } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getAdminUser(context);
  if (!user) return ok(null);
  return ok({
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    permissions: user.permissions,
  });
};
