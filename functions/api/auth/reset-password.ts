import { z } from 'zod';
import { HttpError, ok, parseJson } from '../../lib/http';
import { COMMON_PASSWORDS, hashPassword, hashToken, writeAuditLog } from '../../lib/auth';
import type { Env } from '../../lib/types';

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(12),
});

interface ResetPayload {
  email: string;
  userId: number;
  expiresAt: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown';
  const ua = request.headers.get('user-agent') ?? '';

  const body = await parseJson(request, schema);

  if (COMMON_PASSWORDS.includes(body.password.toLowerCase())) {
    throw new HttpError(400, 'WEAK_PASSWORD', 'Password is too common. Please choose a stronger password.');
  }

  const tokenHash = await hashToken(body.token);
  const kvKey = `pwd_reset:${tokenHash}`;
  const stored = await env.FNLSTG_CONFIG.get(kvKey);
  if (!stored) throw new HttpError(400, 'INVALID_TOKEN', 'Reset token is invalid or has expired');

  const payload = JSON.parse(stored) as ResetPayload;
  if (new Date(payload.expiresAt) < new Date()) {
    await env.FNLSTG_CONFIG.delete(kvKey);
    throw new HttpError(400, 'TOKEN_EXPIRED', 'Reset token has expired');
  }

  const { hash, salt, algo } = await hashPassword(body.password);

  await env.FNLSTG_DB
    .prepare(
      `UPDATE admin_users
       SET password_hash = ?, password_salt = ?, password_algo = ?,
           password_updated_at = datetime('now'), failed_login_count = 0, locked_until = NULL
       WHERE id = ?`,
    )
    .bind(hash, salt, algo, payload.userId)
    .run();

  // Revoke all sessions on password change
  await env.FNLSTG_DB
    .prepare(`UPDATE admin_sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL`)
    .bind(payload.userId)
    .run();

  await env.FNLSTG_CONFIG.delete(kvKey);

  await writeAuditLog(env.FNLSTG_DB, 'auth.password_reset', {
    userId: payload.userId,
    ip,
    ua,
  });

  return ok({ ok: true });
};
