import type { PagesFunction } from '@cloudflare/workers-types';
import { intakeCreateSchema } from '../../../shared/schemas/intake';
import { ok, fail, parseJson, requireAdmin, HttpError } from '../../lib/http';
import type { Env } from '../../lib/types';
import {
    findOrCreateContact,
    normalizeEmail,
    normalizePhoneE164,
} from '../../lib/contacts';

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
          await requireAdmin(context);
          const { results } = await context.env.LNAPAGES_DB
            .prepare(
                      `SELECT i.*,
                                      c.id   AS contact_id_join,
                                                      c.name AS contact_name,
                                                                      c.stage AS contact_stage
                                                                                 FROM intakes i
                                                                                       LEFT JOIN contacts c ON c.id = i.contact_id
                                                                                              ORDER BY i.created_at DESC`,
                    )
            .all();
          return ok(results);
    } catch (err) {
          if (err instanceof HttpError) return fail(err.status, err.code, err.message);
          console.error('[GET /api/intake]', err);
          return fail(500, 'internal_error', 'Failed to list intakes');
    }
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
    try {
          const payload = await parseJson(request, intakeCreateSchema);

      // If an item_id is provided, make sure it points to a real item.
      if (payload.item_id != null) {
              const exists = await env.LNAPAGES_DB
                .prepare('SELECT id FROM items WHERE id = ?')
                .bind(payload.item_id)
                .first();
              if (!exists) {
                        return fail(400, 'invalid_item', 'Intake references an item that does not exist');
              }
      }

      // 60s idempotency: if the same email+phone hit /quote moments ago, return that intake.
      const emailLower = normalizeEmail(payload.email);
          const phoneE164 = normalizePhoneE164(payload.phone);
          if (emailLower || phoneE164) {
                  const dup = await env.LNAPAGES_DB
                    .prepare(
                                `SELECT i.*
                                             FROM intakes i
                                                     LEFT JOIN contacts c ON c.id = i.contact_id
                                                                 WHERE (c.email_lower = ? OR c.phone_e164 = ?)
                                                                               AND datetime(i.created_at) >= datetime('now', '-60 seconds')
                                                                                           ORDER BY i.created_at DESC
                                                                                                       LIMIT 1`,
                              )
                    .bind(emailLower, phoneE164)
                    .first<Record<string, unknown>>();
                  if (dup) {
                            return ok(dup, 200);
                  }
          }

      // Look up an existing Contact by email/phone, or create a new one.
      const { contact, created } = await findOrCreateContact(env.LNAPAGES_DB, {
              name: payload.name,
              email: payload.email,
              phone: payload.phone,
              source: 'intake',
      });

      const result = await env.LNAPAGES_DB
            .prepare(
                      `INSERT INTO intakes (
                                 item_id, contact_id, name, email, phone, project_type, budget, timeline, message,
                                            status, created_at, updated_at
                                                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', datetime('now'), datetime('now'))`,
                    )
            .bind(
                      payload.item_id ?? null,
                      contact.id,
                      payload.name,
                      payload.email,
                      payload.phone,
                      payload.project_type,
                      payload.budget ?? null,
                      payload.timeline ?? null,
                      payload.message,
                    )
            .run();

      // Public response intentionally omits Contact internals.
      return ok(
        {
                  id: Number(result.meta.last_row_id ?? 0),
                  ...payload,
                  status: 'new',
                  contact_id: contact.id,
                  contact_created: created,
        },
              201,
            );
    } catch (err) {
          if (err instanceof HttpError) return fail(err.status, err.code, err.message);
          console.error('[POST /api/intake]', err);
          return fail(500, 'internal_error', 'Failed to create intake');
    }
};
