import { z } from 'zod';
import { HttpError, ok, parseJson, requireAdmin } from '../../../lib/http';
import { deriveInviteHmacKey, generateToken, hashToken, writeAuditLog } from '../../../lib/auth';
import type { Env } from '../../../lib/types';

const schema = z.object({
  email: z.string().email().toLowerCase(),
  role: z.enum(['employee', 'admin']),
});

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const user = await requireAdmin(context);
  if (user.role !== 'owner') {
    throw new HttpError(403, 'FORBIDDEN', 'Only owners can send invites');
  }

  const body = await parseJson(request, schema);

  // Check not already an active user
  const existing = await env.LNAPAGES_DB
    .prepare(`SELECT id, status FROM admin_users WHERE email = ?`)
    .bind(body.email)
    .first<{ id: number; status: string }>();

  if (existing && existing.status !== 'deleted') {
    throw new HttpError(409, 'ALREADY_EXISTS', 'A user with that email already exists');
  }

  // Remove any stale invite
  await env.LNAPAGES_DB
    .prepare(`DELETE FROM admin_invites WHERE email = ?`)
    .bind(body.email)
    .run();

  // Derive HKDF subkey for invite tokens
  const subkey = await deriveInviteHmacKey(env.SESSION_SECRET);
  const rawToken = generateToken();
  const rawTokenBytes = new TextEncoder().encode(rawToken);

  // token_hash = HMAC-SHA256(rawToken, subkey) stored in DB
  const hmacBuf = await crypto.subtle.sign('HMAC', subkey, rawTokenBytes);
  const tokenHash = Array.from(new Uint8Array(hmacBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');

  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

  await env.LNAPAGES_DB
    .prepare(
      `INSERT INTO admin_invites (email, role, token_hash, invited_by, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    )
    .bind(body.email, body.role, tokenHash, user.id, expiresAt)
    .run();

  await writeAuditLog(env.LNAPAGES_DB, 'employee.invite', {
    userId: user.id,
    resourceType: 'invite',
    metadata: { email: body.email, role: body.role },
    ip: request.headers.get('cf-connecting-ip') ?? undefined,
    ua: request.headers.get('user-agent') ?? undefined,
  });

  const inviteUrl = `${env.APP_URL}/invite/${encodeURIComponent(rawToken)}`;

  // Best-effort email delivery
  if (env.RESEND_API_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: body.email,
        subject: 'You have been invited',
        text: `You have been invited to join as ${body.role}.\n\nClick the link below to set your password and accept the invite (expires in 72 hours):\n\n${inviteUrl}\n\nIf you did not expect this invite, you can ignore this email.`,
      }),
    }).catch((err: unknown) => console.error('[invite] email send failed:', err));
  }

  return ok({ email: body.email, role: body.role, expiresAt, inviteUrl }, 201);
};
