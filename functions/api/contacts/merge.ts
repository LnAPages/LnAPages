import { z } from 'zod';
import type { PagesFunction } from '@cloudflare/workers-types';
import { ok, fail, parseJson, requireAdmin, HttpError } from '../../lib/http';
import type { Env } from '../../lib/types';

const mergeSchema = z.object({
  /** The contact to keep. */
  keep_id:   z.number().int().positive(),
  /** The contact to merge into keep_id (will be deleted after merge). */
  merge_id:  z.number().int().positive(),
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

// ── POST /api/contacts/merge ─────────────────────────────────────────────────

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    await requireAdmin(context);
    const { keep_id, merge_id } = await parseJson(context.request, mergeSchema);

    if (keep_id === merge_id) {
      return fail(400, 'SAME_CONTACT', 'keep_id and merge_id must be different');
    }

    const db = context.env.LNAPAGES_DB;

    const [keep, merging] = await Promise.all([
      db.prepare('SELECT * FROM contacts WHERE id = ?').bind(keep_id).first<ContactRow>(),
      db.prepare('SELECT * FROM contacts WHERE id = ?').bind(merge_id).first<ContactRow>(),
    ]);

    if (!keep)   return fail(404, 'NOT_FOUND', `Contact ${keep_id} not found`);
    if (!merging) return fail(404, 'NOT_FOUND', `Contact ${merge_id} not found`);

    // Merge tags (union).
    const tagsKeep:   string[] = JSON.parse(keep.tags_json   ?? '[]');
    const tagsMerge:  string[] = JSON.parse(merging.tags_json ?? '[]');
    const mergedTags = Array.from(new Set([...tagsKeep, ...tagsMerge]));

    // Re-point FK references.
    await db.prepare('UPDATE bookings SET contact_id = ? WHERE contact_id = ?').bind(keep_id, merge_id).run();
    await db.prepare('UPDATE intakes  SET contact_id = ? WHERE contact_id = ?').bind(keep_id, merge_id).run();

    // Update keep record: fill blanks from merging record and update tags.
    await db
      .prepare(`UPDATE contacts SET
        email            = COALESCE(email, ?),
        email_lower      = COALESCE(email_lower, ?),
        phone            = COALESCE(phone, ?),
        phone_e164       = COALESCE(phone_e164, ?),
        notes            = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE
                             CASE WHEN ? IS NULL OR ? = '' THEN notes
                             ELSE notes || char(10) || char(10) || ?
                             END
                           END,
        tags_json        = ?,
        updated_at       = datetime('now'),
        last_activity_at = datetime('now')
       WHERE id = ?`)
      .bind(
        merging.email,
        merging.email_lower,
        merging.phone,
        merging.phone_e164,
        merging.notes,       // CASE branch: notes is null/empty on keep
        merging.notes,       // CASE inner: check merging.notes is null/empty
        merging.notes,
        merging.notes,       // appended
        JSON.stringify(mergedTags),
        keep_id,
      )
      .run();

    // Delete the merged contact.
    await db.prepare('DELETE FROM contacts WHERE id = ?').bind(merge_id).run();

    const result = await db
      .prepare('SELECT * FROM contacts WHERE id = ?')
      .bind(keep_id)
      .first<ContactRow>();

    const { tags_json, email_lower, phone_e164, ...rest } = result!;
    return ok({ ...rest, tags: JSON.parse(tags_json ?? '[]') });
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.code, err.message);
    console.error('[POST /api/contacts/merge]', err);
    return fail(500, 'internal_error', 'Failed to merge contacts');
  }
};
