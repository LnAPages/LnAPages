import { z } from 'zod';
import type { PagesFunction } from '@cloudflare/workers-types';
import { ok, fail, parseJson, requireAdmin, HttpError } from '../../lib/http';
import type { Env } from '../../lib/types';

// ── helpers ─────────────────────────────────────────────────────────────────

function normaliseEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  return s.length ? s : null;
}

/** Very light E.164 normalisation: strip non-digits, prepend +1 if 10 digits (US). */
function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits.length) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  // Already includes country code
  return `+${digits}`;
}

const VALID_STAGES = [
  'new_lead', 'qualified', 'proposal', 'booked',
  'in_production', 'delivered', 'past_client', 'lost',
] as const;

const contactCreateSchema = z.object({
  name:    z.string().min(1),
  email:   z.string().email().optional().nullable(),
  phone:   z.string().optional().nullable(),
  source:  z.enum(['intake', 'booking', 'manual']).default('manual'),
  stage:   z.enum(VALID_STAGES).default('new_lead'),
  tags:    z.array(z.string()).default([]),
  notes:   z.string().optional().nullable(),
});

type ContactRow = {
  id: number;
  name: string;
  email: string | null;
  email_lower: string | null;
  phone: string | null;
  phone_e164: string | null;
  source: string;
  stage: string;
  tags_json: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
};

function toContact(row: ContactRow) {
  const { tags_json, email_lower, phone_e164, ...rest } = row;
  return { ...rest, tags: JSON.parse(tags_json ?? '[]') as string[] };
}

// ── GET /api/contacts ────────────────────────────────────────────────────────

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    await requireAdmin(context);
    const url = new URL(context.request.url);
    const q     = url.searchParams.get('q')?.trim() ?? '';
    const stage = url.searchParams.get('stage')?.trim() ?? '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '200', 10), 500);

    let sql = 'SELECT * FROM contacts';
    const bindings: unknown[] = [];
    const conditions: string[] = [];

    if (q) {
      conditions.push("(name LIKE ? OR email LIKE ? OR phone LIKE ?)");
      const like = `%${q}%`;
      bindings.push(like, like, like);
    }
    if (stage && VALID_STAGES.includes(stage as typeof VALID_STAGES[number])) {
      conditions.push('stage = ?');
      bindings.push(stage);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY last_activity_at DESC LIMIT ?';
    bindings.push(limit);

    const { results } = await context.env.FNLSTG_DB
      .prepare(sql)
      .bind(...bindings)
      .all<ContactRow>();

    return ok((results ?? []).map(toContact));
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.code, err.message);
    console.error('[GET /api/contacts]', err);
    return fail(500, 'internal_error', 'Failed to list contacts');
  }
};

// ── POST /api/contacts ───────────────────────────────────────────────────────

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    await requireAdmin(context);
    const payload = await parseJson(context.request, contactCreateSchema);

    const emailLower = normaliseEmail(payload.email);
    const phoneE164  = normalisePhone(payload.phone);
    const tagsJson   = JSON.stringify(payload.tags);

    // Dedup: look for an existing contact by email or phone.
    let existing: ContactRow | null = null;
    if (emailLower) {
      existing = await context.env.FNLSTG_DB
        .prepare('SELECT * FROM contacts WHERE email_lower = ?')
        .bind(emailLower)
        .first<ContactRow>();
    }
    if (!existing && phoneE164) {
      existing = await context.env.FNLSTG_DB
        .prepare('SELECT * FROM contacts WHERE phone_e164 = ?')
        .bind(phoneE164)
        .first<ContactRow>();
    }

    if (existing) {
      // Merge: update non-null incoming fields onto the existing record.
      await context.env.FNLSTG_DB
        .prepare(`UPDATE contacts SET
          name             = COALESCE(?, name),
          email            = COALESCE(?, email),
          email_lower      = COALESCE(?, email_lower),
          phone            = COALESCE(?, phone),
          phone_e164       = COALESCE(?, phone_e164),
          stage            = ?,
          notes            = COALESCE(?, notes),
          updated_at       = datetime('now'),
          last_activity_at = datetime('now')
         WHERE id = ?`)
        .bind(
          payload.name ?? null,
          payload.email ?? null,
          emailLower,
          payload.phone ?? null,
          phoneE164,
          payload.stage,
          payload.notes ?? null,
          existing.id,
        )
        .run();

      const updated = await context.env.FNLSTG_DB
        .prepare('SELECT * FROM contacts WHERE id = ?')
        .bind(existing.id)
        .first<ContactRow>();
      return ok(toContact(updated!), 200);
    }

    // Insert new contact.
    const result = await context.env.FNLSTG_DB
      .prepare(`INSERT INTO contacts
        (name, email, email_lower, phone, phone_e164, source, stage, tags_json, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        payload.name,
        payload.email ?? null,
        emailLower,
        payload.phone ?? null,
        phoneE164,
        payload.source,
        payload.stage,
        tagsJson,
        payload.notes ?? null,
      )
      .run();

    const created = await context.env.FNLSTG_DB
      .prepare('SELECT * FROM contacts WHERE id = ?')
      .bind(Number(result.meta.last_row_id ?? 0))
      .first<ContactRow>();
    return ok(toContact(created!), 201);
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.code, err.message);
    console.error('[POST /api/contacts]', err);
    return fail(500, 'internal_error', 'Failed to create contact');
  }
};
