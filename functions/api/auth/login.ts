import { z } from 'zod';
import { HttpError, fail, ok, parseJson } from '../../lib/http';
import {
  checkRateLimit,
  clearRateLimit,
  computeCsrfToken,
  generateToken,
  hashToken,
  recordRateLimit,
  signSessionToken,
  verifyPassword,
  writeAuditLog,
} from '../../lib/auth';
import type { Env } from '../../lib/types';

const schema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

interface AdminUserRow {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  password_hash: string | null;
  password_salt: string | null;
  password_algo: string | null;
  failed_login_count: number;
  locked_until: string | null;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  let body: z.infer<typeof schema>;
  try {
    body = await parseJson(request, schema);
  } catch {
    return fail(400, 'VALIDATION_ERROR', 'Invalid request body');
  }

  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown';
  const ua = request.headers.get('user-agent') ?? '';
  const emailKey = `login:email:${body.email}`;
  const ipKey = `login:ip:${ip}`;

  // Check rate limits
  const emailLimited = await checkRateLimit(env.LNAPAGES_DB, emailKey, 5, 15);
  const ipLimited = await checkRateLimit(env.LNAPAGES_DB, ipKey, 20, 15);
  if (emailLimited || ipLimited) {
    throw new HttpError(429, 'RATE_LIMITED', 'Too many login attempts. Please try again later.');
  }

  const user = await env.LNAPAGES_DB
    .prepare(
      `SELECT id, email, name, role, status, password_hash, password_salt, password_algo,
              failed_login_count, locked_until
       FROM admin_users WHERE email = ?`,
    )
    .bind(body.email)
    .first<AdminUserRow>();

  // Generic failure to avoid user enumeration
  const genericFail = async () => {
    await recordRateLimit(env.LNAPAGES_DB, emailKey);
    await recordRateLimit(env.LNAPAGES_DB, ipKey);
    return fail(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  };

  if (!user) return genericFail();
  if (user.status === 'suspended' || user.status === 'deleted') {
    return fail(403, 'ACCOUNT_INACTIVE', 'Account is not active');
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return fail(403, 'ACCOUNT_LOCKED', 'Account is temporarily locked due to too many failed attempts');
  }
  if (!user.password_hash || !user.password_salt) return genericFail();

  const valid = await verifyPassword(body.password, user.password_hash, user.password_salt);
  if (!valid) {
    const newCount = (user.failed_login_count ?? 0) + 1;
    const lockedUntil = newCount >= 10 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    await env.LNAPAGES_DB
      .prepare(
        `UPDATE admin_users SET failed_login_count = ?, locked_until = ? WHERE id = ?`,
      )
      .bind(newCount, lockedUntil, user.id)
      .run();
    await recordRateLimit(env.LNAPAGES_DB, emailKey);
    await recordRateLimit(env.LNAPAGES_DB, ipKey);
    return fail(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // Success — issue session
  await clearRateLimit(env.LNAPAGES_DB, emailKey);

  const rawToken = generateToken();
  const tokenHash = await hashToken(rawToken);
  const signedToken = await signSessionToken(rawToken, env.SESSION_SECRET);
  const csrfToken = await computeCsrfToken(rawToken, env.SESSION_SECRET);

  await env.LNAPAGES_DB
    .prepare(
      `INSERT INTO admin_sessions (user_id, token, expires_at, created_at, ip_address, user_agent, last_seen_at)
       VALUES (?, ?, datetime('now', '+14 days'), datetime('now'), ?, ?, datetime('now'))`,
    )
    .bind(user.id, tokenHash, ip, ua)
    .run();

  await env.LNAPAGES_DB
    .prepare(
      `UPDATE admin_users SET last_login_at = datetime('now'), failed_login_count = 0, locked_until = NULL WHERE id = ?`,
    )
    .bind(user.id)
    .run();

  await writeAuditLog(env.LNAPAGES_DB, 'auth.login', { userId: user.id, ip, ua });

  const response = ok({ email: user.email, name: user.name, role: user.role });
  response.headers.append(
    'Set-Cookie',
    `lnapages_session=${encodeURIComponent(signedToken)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=1209600`,
  );
  response.headers.append(
    'Set-Cookie',
    `lnapages_csrf=${csrfToken}; Secure; SameSite=Lax; Path=/; Max-Age=1209600`,
  );
  return response;
};
