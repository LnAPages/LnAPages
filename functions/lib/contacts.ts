import type { D1Database } from '@cloudflare/workers-types';

/**
   * Lowercase + trim email for dedup. Returns null when input is empty / clearly invalid.
   */
export function normalizeEmail(input: string | null | undefined): string | null {
    if (!input) return null;
  const trimmed = String(input).trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) return null;
  return trimmed;
}

/**
 * Strip all non-digits, then return E.164. We only auto-prepend +1 for 10-digit US numbers.
   * Returns null when input is empty or fewer than 10 digits.
   */
export function normalizePhoneE164(input: string | null | undefined): string | null {
    if (!input) return null;
  const digits = String(input).replace(/\D+/g, '');
      if (!digits) return null;
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  if (digits.length >= 8 && digits.length <= 15) return '+' + digits;
  return null;
}

export interface ContactRow {
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
}

export interface ContactSeed {
    name: string;
  email?: string | null;
  phone?: string | null;
  source?: string;
}

export interface FindOrCreateResult {
    contact: ContactRow;
  created: boolean;
}

/**
 * Look up a Contact by lowercased email OR E.164 phone. If found, bump
   * last_activity_at and return it. Otherwise insert a new Contact with
 * the given source (default 'intake') and stage 'new_lead'.
   */
export async function findOrCreateContact(
  db: D1Database,
  seed: ContactSeed,
  ): Promise<FindOrCreateResult> {
    const emailLower = normalizeEmail(seed.email);
  const phoneE164 = normalizePhoneE164(seed.phone);
  const source = seed.source ?? 'intake';

  // Lookup: prefer email match, fall back to phone.
  let existing: ContactRow | null = null;
  if (emailLower) {
    existing = (await db
            .prepare('SELECT * FROM contacts WHERE email_lower = ? LIMIT 1')
            .bind(emailLower)
            .first<ContactRow>()) ?? null;
  }
  if (!existing && phoneE164) {
    existing = (await db
            .prepare('SELECT * FROM contacts WHERE phone_e164 = ? LIMIT 1')
            .bind(phoneE164)
            .first<ContactRow>()) ?? null;
  }

  if (existing) {
    await db
      .prepare(
        `UPDATE contacts
            SET last_activity_at = datetime('now'),
                updated_at = datetime('now')
          WHERE id = ?`,
            )
            .bind(existing.id)
            .run();
    return { contact: existing, created: false };
  }

  const insert = await db
    .prepare(
          `INSERT INTO contacts (
             name, email, email_lower, phone, phone_e164,
             source, stage, tags_json,
             created_at, updated_at, last_activity_at
           ) VALUES (?, ?, ?, ?, ?, ?, 'new_lead', '[]',
                     datetime('now'), datetime('now'), datetime('now'))`,
        )
        .bind(
          seed.name,
          seed.email ?? null,
          emailLower,
          seed.phone ?? null,
          phoneE164,
          source,
        )
        .run();

  const id = Number(insert.meta.last_row_id ?? 0);
  const contact = (await db
    .prepare('SELECT * FROM contacts WHERE id = ?')
    .bind(id)
    .first<ContactRow>())!;

  return { contact, created: true };
}
