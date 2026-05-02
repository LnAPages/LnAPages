/**
 * Google Calendar helpers for Cloudflare Workers (no external SDK).
 *
 * Auth model: Google Cloud service account, shared on the target calendar as
 * "Make changes to events".  JWT is signed with RS256 via crypto.subtle so
 * there is no `googleapis` dependency — it does not run on Workers.
 *
 * Access tokens are cached in LNAPAGES_CONFIG KV under `google:access_token`
 * with a TTL of 3 300 s (55 min) so each Worker process reuses one token.
 */

import type { Env } from './types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

/** Base-64url encode a Uint8Array (no padding). */
function b64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Encode an object as a base-64url JSON segment. */
function encodeSegment(obj: unknown): string {
  return b64url(new TextEncoder().encode(JSON.stringify(obj)));
}

/**
 * Import a PKCS#8 PEM private key for RS256 signing.
 * Service-account JSON keys are PKCS#8 ("-----BEGIN PRIVATE KEY-----").
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');

  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

/** Sign `header.payload` with the service account private key (RS256). */
async function signJwt(header: unknown, payload: unknown, pem: string): Promise<string> {
  const key = await importPrivateKey(pem);
  const data = `${encodeSegment(header)}.${encodeSegment(payload)}`;
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(data),
  );
  return `${data}.${b64url(new Uint8Array(sig))}`;
}

// ---------------------------------------------------------------------------
// Public: mintGoogleAccessToken
// ---------------------------------------------------------------------------

/**
 * Obtain a Google OAuth2 access token for the service account.
 * Result is cached in LNAPAGES_CONFIG KV for 55 minutes.
 */
export async function mintGoogleAccessToken(env: Env): Promise<string> {
  // 1. Try the cache first.
  const cached = await env.LNAPAGES_CONFIG.get('google:access_token');
  if (cached) return cached;

  // 2. Parse the service account JSON.
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not configured');
  }
  const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON) as ServiceAccountKey;

  // 3. Build the JWT assertion.
  const now = Math.floor(Date.now() / 1000);
  const jwt = await signJwt(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: sa.client_email,
      sub: sa.client_email,
      scope: 'https://www.googleapis.com/auth/calendar',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    sa.private_key,
  );

  // 4. Exchange for an access token.
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google token exchange failed (${resp.status}): ${text}`);
  }

  const data = (await resp.json()) as { access_token: string };
  const token = data.access_token;

  // 5. Cache for 55 minutes (token lifetime is 60 min).
  await env.LNAPAGES_CONFIG.put('google:access_token', token, { expirationTtl: 3300 });

  return token;
}

// ---------------------------------------------------------------------------
// Public: createCalendarEvent
// ---------------------------------------------------------------------------

export interface CalendarDateTime {
  dateTime: string;
  timeZone?: string;
}

export interface CreateCalendarEventParams {
  summary: string;
  description?: string;
  start: CalendarDateTime;
  end: CalendarDateTime;
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  };
}

export interface CalendarEventResult {
  id: string;
  htmlLink: string;
}

/**
 * Create an event on the shop's Google Calendar.
 * Returns the event `id` and `htmlLink` on success.
 *
 * Note: attendees are intentionally omitted — service accounts cannot send
 * invite emails without domain-wide delegation; customer comms will go through
 * Twilio/Resend in a separate issue.
 */
export async function createCalendarEvent(
  env: Env,
  params: CreateCalendarEventParams,
): Promise<CalendarEventResult> {
  if (!env.GOOGLE_CALENDAR_ID) {
    throw new Error('GOOGLE_CALENDAR_ID is not configured');
  }

  const token = await mintGoogleAccessToken(env);
  const calendarId = encodeURIComponent(env.GOOGLE_CALENDAR_ID);

  const resp = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    },
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google Calendar createEvent failed (${resp.status}): ${text}`);
  }

  const event = (await resp.json()) as { id: string; htmlLink: string };
  return { id: event.id, htmlLink: event.htmlLink };
}

// ---------------------------------------------------------------------------
// Public: deleteCalendarEvent
// ---------------------------------------------------------------------------

/**
 * Delete an event from the shop's Google Calendar.
 * Used for cancel/reschedule flows (future issues).
 */
export async function deleteCalendarEvent(env: Env, eventId: string): Promise<void> {
  if (!env.GOOGLE_CALENDAR_ID) {
    throw new Error('GOOGLE_CALENDAR_ID is not configured');
  }

  const token = await mintGoogleAccessToken(env);
  const calendarId = encodeURIComponent(env.GOOGLE_CALENDAR_ID);

  const resp = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  // 204 No Content = success; 410 Gone = already deleted (treat as ok).
  if (!resp.ok && resp.status !== 410) {
    const text = await resp.text();
    throw new Error(`Google Calendar deleteEvent failed (${resp.status}): ${text}`);
  }
}
