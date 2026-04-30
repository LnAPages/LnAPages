import { z } from 'zod';
import { ok, parseJson } from '../../lib/http';
import { checkRateLimit, generateToken, hashToken, recordRateLimit, writeAuditLog } from '../../lib/auth';
import type { Env } from '../../lib/types';

const schema = z.object({
  email: z.string().email().toLowerCase(),
});

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown';
  const ua = request.headers.get('user-agent') ?? '';

  const body = await parseJson(request, schema);

  // Rate limit: 3 per email per hour
  const bucketKey = `pwd_reset:${body.email}`;
  const limited = await checkRateLimit(env.LNAPAGES_DB, bucketKey, 3, 60);
  if (limited) {
    // Return ok to avoid user enumeration
    return ok({ sent: true });
  }
  await recordRateLimit(env.LNAPAGES_DB, bucketKey);

  const user = await env.LNAPAGES_DB
    .prepare(`SELECT id, email, name, status FROM admin_users WHERE email = ?`)
    .bind(body.email)
    .first<{ id: number; email: string; name: string; status: string }>();

  if (!user || user.status === 'deleted' || user.status === 'suspended') {
    return ok({ sent: true }); // silent — don't reveal if email exists
  }

  const rawToken = generateToken();
  const tokenHash = await hashToken(rawToken);
  const kvKey = `pwd_reset:${tokenHash}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await env.LNAPAGES_CONFIG.put(kvKey, JSON.stringify({ email: user.email, userId: user.id, expiresAt }), {
    expirationTtl: 3600,
  });

  const resetUrl = `${env.APP_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;

  // Best-effort email — if RESEND_API_KEY is configured
  if (env.RESEND_API_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: user.email,
        subject: 'Reset your password',
        text: `Hi ${user.name},\n\nClick the link below to reset your password. It expires in 1 hour.\n\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
      }),
    }).catch((err: unknown) => console.error('[forgot-password] email send failed:', err));
  }

  await writeAuditLog(env.LNAPAGES_DB, 'auth.password_reset_requested', {
    userId: user.id,
    ip,
    ua,
  });

  return ok({ sent: true });
};
