import { z } from 'zod';
import type { PagesFunction } from '@cloudflare/workers-types';
import { ok, fail, parseJson, requireAdmin, HttpError } from '../../lib/http';
import type { Env } from '../../lib/types';

const idSchema = z.coerce.number().int().positive();

const VALID_STAGES = [
  'new_lead', 'qualified', 'proposal', 'booked',
  'in_production', 'delivered', 'past_client', 'lost',
] as const;

const contactUpdateSchema = z.object({
  name:   z.string().min(1).optional(),
  email:  z.string().email().optional().nullable(),
  phone:  z.string().optional().nullable(),
  source: z.enum(['intake', 'booking', 'manual']).optional(),
  stage:  z.enum(VALID_STAGES).optional(),
  tags:   z.array(z.string()).optional(),
  notes:  z.string().optional().nullable(),
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

function normaliseEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  return s.length ? s : null;
}

function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits.length) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  return `+${digits}`;
}

// ── GET /api/contacts/:id ────────────────────────────────────────────────────

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    await requireAdmin(context);
    const id = idSchema.parse(context.params.id);
    const row = await context.env.FNLSTG_DB
      .prepare('SELECT * FROM contacts WHERE id = ?')
      .bind(id)
      .first<ContactRow>();
    if (!row) return fail(404, 'NOT_FOUND', 'Contact not found');
    return ok(toContact(row));
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.code, err.message);
    console.error('[GET /api/contacts/:id]', err);
    return fail(500, 'internal_error', 'Failed to get contact');
  }
};

// ── PATCH /api/contacts/:id ──────────────────────────────────────────────────

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  try {
    await requireAdmin(context);
    const id      = idSchema.parse(context.params.id);
    const payload = await parseJson(context.request, contactUpdateSchema);

    const emailLower = payload.email !== undefined ? normaliseEmail(payload.email) : undefined;
    const phoneE164  = payload.phone !== undefined ? normalisePhone(payload.phone) : undefined;

    await context.env.FNLSTG_DB
      .prepare(`UPDATE contacts SET
        name             = COALESCE(?, name),
        email            = COALESCE(?, email),
        email_lower      = COALESCE(?, email_lower),
        phone            = COALESCE(?, phone),
        phone_e164       = COALESCE(?, phone_e164),
        source           = COALESCE(?, source),
        stage            = COALESCE(?, stage),
        tags_json        = COALESCE(?, tags_json),
        notes            = COALESCE(?, notes),
        updated_at       = datetime('now'),
        last_activity_at = datetime('now')
       WHERE id = ?`)
      .bind(
        payload.name ?? null,
        payload.email !== undefined ? (payload.email ?? null) : null,
        emailLower !== undefined ? emailLower : null,
        payload.phone !== undefined ? (payload.phone ?? null) : null,
        phoneE164 !== undefined ? phoneE164 : null,
        payload.source ?? null,
        payload.stage ?? null,
        payload.tags !== undefined ? JSON.stringify(payload.tags) : null,
        payload.notes !== undefined ? (payload.notes ?? null) : null,
        id,
      )
      .run();

    const updated = await context.env.FNLSTG_DB
      .prepare('SELECT * FROM contacts WHERE id = ?')
      .bind(id)
      .first<ContactRow>();
    if (!updated) return fail(404, 'NOT_FOUND', 'Contact not found');
    return ok(toContact(updated));
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.code, err.message);
    console.error('[PATCH /api/contacts/:id]', err);
    return fail(500, 'internal_error', 'Failed to update contact');
  }
};

// ── DELETE /api/contacts/:id ─────────────────────────────────────────────────

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    await requireAdmin(context);
    const id = idSchema.parse(context.params.id);
    await context.env.FNLSTG_DB
      .prepare('DELETE FROM contacts WHERE id = ?')
      .bind(id)
      .run();
    return ok({ id });
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.code, err.message);
    console.error('[DELETE /api/contacts/:id]', err);
    return fail(500, 'internal_error', 'Failed to delete contact');
  }
};
