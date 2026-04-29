import { z } from 'zod';
import { HttpError, ok, parseJson } from '../../lib/http';
import {
  COMMON_PASSWORDS,
  deriveInviteHmacKey,
  hashPassword,
  writeAuditLog,
} from '../../lib/auth';
import type { Env } from '../../lib/types';

const acceptSchema = z.object({
  password: z.string().min(12),
  name: z.string().min(1).max(100).optional(),
});

interface InviteRow {
  id: number;
  email: string;
  role: string;
  token_hash: string;
  invited_by: number | null;
  expires_at: string;
  accepted_at: string | null;
}

async function validateInviteToken(
  env: Env,
  rawToken: string,
): Promise<InviteRow | null> {
  const subkey = await deriveInviteHmacKey(env.SESSION_SECRET);
  const rawTokenBytes = new TextEncoder().encode(rawToken);
  const hmacBuf = await crypto.subtle.sign('HMAC', subkey, rawTokenBytes);
  const tokenHash = Array.from(new Uint8Array(hmacBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return env.FNLSTG_DB
    .prepare(
      `SELECT id, email, role, token_hash, invited_by, expires_at, accepted_at
       FROM admin_invites WHERE token_hash = ?`,
    )
    .bind(tokenHash)
    .first<InviteRow>();
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const rawToken = decodeURIComponent(context.params['token'] as string);
  const invite = await validateInviteToken(context.env, rawToken);

  if (!invite) throw new HttpError(404, 'INVITE_NOT_FOUND', 'Invite not found or invalid');
  if (invite.accepted_at) throw new HttpError(410, 'INVITE_USED', 'This invite has already been accepted');
  if (new Date(invite.expires_at) < new Date()) throw new HttpError(410, 'INVITE_EXPIRED', 'This invite has expired');

  return ok({ email: invite.email, role: invite.role, expiresAt: invite.expires_at });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const rawToken = decodeURIComponent(context.params['token'] as string);
  const invite = await validateInviteToken(env, rawToken);

  if (!invite) throw new HttpError(404, 'INVITE_NOT_FOUND', 'Invite not found or invalid');
  if (invite.accepted_at) throw new HttpError(410, 'INVITE_USED', 'This invite has already been accepted');
  if (new Date(invite.expires_at) < new Date()) throw new HttpError(410, 'INVITE_EXPIRED', 'This invite has expired');

  const body = await parseJson(request, acceptSchema);

  if (COMMON_PASSWORDS.includes(body.password.toLowerCase())) {
    throw new HttpError(400, 'WEAK_PASSWORD', 'Password is too common. Please choose a stronger password.');
  }

  const { hash, salt, algo } = await hashPassword(body.password);

  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown';
  const ua = request.headers.get('user-agent') ?? '';

  // Upsert user
  const existing = await env.FNLSTG_DB
    .prepare(`SELECT id FROM admin_users WHERE email = ?`)
    .bind(invite.email)
    .first<{ id: number }>();

  let userId: number;
  if (existing) {
    await env.FNLSTG_DB
      .prepare(
        `UPDATE admin_users SET
           password_hash = ?, password_salt = ?, password_algo = ?,
           password_updated_at = datetime('now'),
           role = ?, status = 'active',
           name = COALESCE(?, name),
           invited_by = ?, invited_at = datetime('now')
         WHERE id = ?`,
      )
      .bind(hash, salt, algo, invite.role, body.name ?? null, invite.invited_by, existing.id)
      .run();
    userId = existing.id;
  } else {
    const result = await env.FNLSTG_DB
      .prepare(
        `INSERT INTO admin_users
           (email, name, role, status, password_hash, password_salt, password_algo,
            password_updated_at, invited_by, invited_at, created_at)
         VALUES (?, ?, ?, 'active', ?, ?, ?, datetime('now'), ?, datetime('now'), datetime('now'))`,
      )
      .bind(
        invite.email,
        body.name ?? invite.email.split('@')[0],
        invite.role,
        hash, salt, algo,
        invite.invited_by,
      )
      .run();
    userId = Number(result.meta.last_row_id ?? 0);
  }

  await env.FNLSTG_DB
    .prepare(`UPDATE admin_invites SET accepted_at = datetime('now') WHERE id = ?`)
    .bind(invite.id)
    .run();

  await writeAuditLog(env.FNLSTG_DB, 'auth.invite_accepted', {
    userId,
    resourceType: 'invite',
    resourceId: String(invite.id),
    ip,
    ua,
  });

  return ok({ ok: true, email: invite.email, role: invite.role });
};
