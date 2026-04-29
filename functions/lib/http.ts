import type { ZodType } from 'zod';
import type { ApiFailure, ApiSuccess, Env } from './types';
import { verifySessionToken, hashToken, computeCsrfToken } from './auth';

export class HttpError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200, headers?: HeadersInit): Response {
  const payload: ApiSuccess<T> = { ok: true, data };
  return Response.json(payload, { status, headers });
}

export function fail(status: number, code: string, message: string): Response {
  const payload: ApiFailure = { ok: false, error: { code, message } };
  return Response.json(payload, { status });
}

export function corsHeaders(origin = '*'): Headers {
  return new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-CSRF-Token',
  });
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const raw = await request.json();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '));
  }
  return parsed.data;
}

function readCookie(request: Request, name: string): string | null {
  const value = request.headers.get('cookie');
  if (!value) return null;
  const entry = value.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.split('=').slice(1).join('=')) : null;
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  permissions: string[];
  /** Raw token (only set for new HMAC sessions, used for CSRF checks) */
  rawToken?: string;
}

interface SessionRow {
  id: number;
  user_id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  revoked_at: string | null;
  expires_at: string;
}

async function loadPermissions(db: D1Database, userId: number): Promise<string[]> {
  const rows = await db
    .prepare('SELECT panel_key FROM admin_panel_permissions WHERE user_id = ? AND can_view = 1')
    .bind(userId)
    .all<{ panel_key: string }>();
  return rows.results.map((r) => r.panel_key);
}

export async function getAdminUser(context: EventContext<Env, string, unknown>): Promise<AdminUser | null> {
  const db = context.env.FNLSTG_DB;

  // ── New HMAC-signed session (fnlstg_session cookie) ─────────────────────
  const newCookie = readCookie(context.request, 'fnlstg_session');
  if (newCookie && context.env.SESSION_SECRET) {
    const rawToken = await verifySessionToken(newCookie, context.env.SESSION_SECRET);
    if (rawToken) {
      const tokenHash = await hashToken(rawToken);
      const row = await db
        .prepare(
          `SELECT s.id, s.user_id, s.revoked_at, s.expires_at,
                  u.email, u.name, u.role, u.status
           FROM admin_sessions s
           JOIN admin_users u ON s.user_id = u.id
           WHERE s.token = ? AND s.expires_at > datetime('now') AND s.revoked_at IS NULL`,
        )
        .bind(tokenHash)
        .first<SessionRow>();

      if (row && row.status === 'active') {
        // Async last_seen_at update — fire and forget
        db.prepare("UPDATE admin_sessions SET last_seen_at = datetime('now') WHERE id = ?")
          .bind(row.id)
          .run()
          .catch((err: unknown) => console.error('[session] last_seen_at update failed:', err));

        const permissions = await loadPermissions(db, row.user_id);
        return { id: row.user_id, email: row.email, name: row.name, role: row.role, status: row.status, permissions, rawToken };
      }
    }
  }

  // ── Legacy GitHub OAuth session (session_token cookie) ──────────────────
  const legacyToken = readCookie(context.request, 'session_token');
  if (legacyToken) {
    const row = await db
      .prepare(
        `SELECT s.id, s.user_id, s.revoked_at, s.expires_at,
                u.email, u.name,
                COALESCE(u.role, 'admin') as role,
                COALESCE(u.status, 'active') as status
         FROM admin_sessions s
         JOIN admin_users u ON s.user_id = u.id
         WHERE s.token = ? AND s.expires_at > datetime('now') AND s.revoked_at IS NULL`,
      )
      .bind(legacyToken)
      .first<SessionRow>();

    if (row) {
      const permissions = await loadPermissions(db, row.user_id);
      return { id: row.user_id, email: row.email, name: row.name, role: row.role, status: row.status, permissions };
    }
  }

  return null;
}

export async function requireAdmin(context: EventContext<Env, string, unknown>): Promise<AdminUser> {
  const user = await getAdminUser(context);
  if (!user) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Admin session required');
  }
  return user;
}

export async function verifyCsrf(context: EventContext<Env, string, unknown>, user: AdminUser): Promise<void> {
  if (!user.rawToken || !context.env.SESSION_SECRET) return; // legacy sessions skip CSRF
  const header = context.request.headers.get('x-csrf-token');
  if (!header) throw new HttpError(403, 'CSRF_MISSING', 'X-CSRF-Token header required');
  const expected = await computeCsrfToken(user.rawToken, context.env.SESSION_SECRET);
  if (header !== expected) throw new HttpError(403, 'CSRF_MISMATCH', 'CSRF token mismatch');
}
