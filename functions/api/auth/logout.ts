import { ok } from '../../lib/http';
import { verifySessionToken, hashToken, writeAuditLog } from '../../lib/auth';
import type { Env } from '../../lib/types';

function readCookie(request: Request, name: string): string | null {
  const value = request.headers.get('cookie');
  if (!value) return null;
  const entry = value.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.split('=').slice(1).join('=')) : null;
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown';
  const ua = request.headers.get('user-agent') ?? '';

  // Revoke new HMAC session
  const newCookie = readCookie(request, 'fnlstg_session');
  if (newCookie && env.SESSION_SECRET) {
    const rawToken = await verifySessionToken(newCookie, env.SESSION_SECRET);
    if (rawToken) {
      const tokenHash = await hashToken(rawToken);
      const row = await env.FNLSTG_DB
        .prepare(`SELECT id, user_id FROM admin_sessions WHERE token = ? AND revoked_at IS NULL`)
        .bind(tokenHash)
        .first<{ id: number; user_id: number }>();
      if (row) {
        await env.FNLSTG_DB
          .prepare(`UPDATE admin_sessions SET revoked_at = datetime('now') WHERE id = ?`)
          .bind(row.id)
          .run();
        await writeAuditLog(env.FNLSTG_DB, 'auth.logout', { userId: row.user_id, ip, ua });
      }
    }
  }

  // Revoke legacy session
  const legacyToken = readCookie(request, 'session_token');
  if (legacyToken) {
    await env.FNLSTG_DB
      .prepare(`UPDATE admin_sessions SET revoked_at = datetime('now') WHERE token = ? AND revoked_at IS NULL`)
      .bind(legacyToken)
      .run();
  }

  const response = ok({ loggedOut: true });
  response.headers.append('Set-Cookie', 'fnlstg_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
  response.headers.append('Set-Cookie', 'fnlstg_csrf=; Path=/; Max-Age=0; Secure; SameSite=Lax');
  response.headers.append('Set-Cookie', 'session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
  return response;
};
