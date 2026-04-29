// Auth utilities: password hashing, session signing, invite tokens, CSRF, rate limiting, audit log.

export const COMMON_PASSWORDS = [
  'password', 'password1', '123456', '123456789', '12345678', '1234567890',
  'qwerty', 'qwerty123', 'abc123', 'iloveyou', 'admin', 'letmein',
  'welcome', 'monkey', 'dragon', 'master', 'sunshine', 'princess',
  'shadow', 'superman',
];

// ── base64url helpers ───────────────────────────────────────────────────────

function bufToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlToBuf(s: string): ArrayBuffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + (4 - (s.length % 4)) % 4, '=');
  const bin = atob(padded);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── token generation ────────────────────────────────────────────────────────

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bufToB64url(bytes.buffer);
}

// ── password hashing (PBKDF2-SHA256 @ 600 000 iterations) ──────────────────

export async function hashPassword(password: string): Promise<{ hash: string; salt: string; algo: string }> {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = bufToB64url(saltBytes.buffer);

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: 600_000 },
    keyMaterial,
    256,
  );
  return { hash: bufToB64url(derived), salt, algo: 'pbkdf2-sha256-600k' };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const enc = new TextEncoder();
  const saltBytes = new Uint8Array(b64urlToBuf(salt));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: 600_000 },
    keyMaterial,
    256,
  );
  // Constant-time comparison
  const a = new Uint8Array(derived);
  const b = new Uint8Array(b64urlToBuf(hash));
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ── session token signing (HMAC-SHA256) ────────────────────────────────────

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signSessionToken(token: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token));
  return `${token}.${bufToB64url(sig)}`;
}

export async function verifySessionToken(signed: string, secret: string): Promise<string | null> {
  const dotIdx = signed.lastIndexOf('.');
  if (dotIdx === -1) return null;
  const token = signed.slice(0, dotIdx);
  const sig = signed.slice(dotIdx + 1);
  const key = await importHmacKey(secret);
  try {
    const sigBytes = new Uint8Array(b64urlToBuf(sig));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(token));
    return valid ? token : null;
  } catch {
    return null;
  }
}

// ── CSRF token (HMAC-SHA256 of session token, truncated to 32 hex chars) ───

export async function computeCsrfToken(rawToken: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`csrf:${rawToken}`));
  return bufToHex(sig).slice(0, 32);
}

// ── invite HKDF key derivation ─────────────────────────────────────────────

export async function deriveInviteHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(secret), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(''), info: enc.encode('fnlstg:invite-v1') },
    baseKey,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign', 'verify'],
  );
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return bufToHex(digest);
}

// ── rate limiting ───────────────────────────────────────────────────────────

interface RateLimitRow {
  id: number;
  window_started_at: string;
  attempt_count: number;
  blocked_until: string | null;
}

export async function checkRateLimit(
  db: D1Database,
  bucketKey: string,
  maxAttempts: number,
  windowMinutes: number,
): Promise<boolean> {
  const row = await db
    .prepare('SELECT id, window_started_at, attempt_count, blocked_until FROM auth_rate_limits WHERE bucket_key = ?')
    .bind(bucketKey)
    .first<RateLimitRow>();

  if (!row) return false;

  if (row.blocked_until && new Date(row.blocked_until) > new Date()) return true;

  const windowMs = windowMinutes * 60 * 1000;
  const windowAge = Date.now() - new Date(row.window_started_at).getTime();
  if (windowAge > windowMs) return false; // window expired, not rate limited

  return row.attempt_count >= maxAttempts;
}

/** Default sliding window size in seconds (15 minutes) used by recordRateLimit. */
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

export async function recordRateLimit(
  db: D1Database,
  bucketKey: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(`
      INSERT INTO auth_rate_limits (bucket_key, window_started_at, attempt_count)
      VALUES (?, ?, 1)
      ON CONFLICT(bucket_key) DO UPDATE SET
        attempt_count = CASE
          WHEN (unixepoch('now') - unixepoch(window_started_at)) > ${RATE_LIMIT_WINDOW_SECONDS} THEN 1
          ELSE attempt_count + 1
        END,
        window_started_at = CASE
          WHEN (unixepoch('now') - unixepoch(window_started_at)) > ${RATE_LIMIT_WINDOW_SECONDS} THEN ?
          ELSE window_started_at
        END
    `)
    .bind(bucketKey, now, now)
    .run();
}

export async function clearRateLimit(db: D1Database, bucketKey: string): Promise<void> {
  await db.prepare('DELETE FROM auth_rate_limits WHERE bucket_key = ?').bind(bucketKey).run();
}

// ── audit log ──────────────────────────────────────────────────────────────

export async function writeAuditLog(
  db: D1Database,
  action: string,
  opts: {
    userId?: number;
    resourceType?: string;
    resourceId?: string;
    metadata?: unknown;
    ip?: string;
    ua?: string;
  } = {},
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO audit_log (user_id, action, resource_type, resource_id, metadata_json, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `)
    .bind(
      opts.userId ?? null,
      action,
      opts.resourceType ?? null,
      opts.resourceId ?? null,
      opts.metadata !== undefined ? JSON.stringify(opts.metadata) : null,
      opts.ip ?? null,
      opts.ua ?? null,
    )
    .run();
}
