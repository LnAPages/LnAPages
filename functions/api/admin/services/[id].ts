import { z } from 'zod';
import { CANONICAL_CATEGORY_SLUGS } from '../../../../shared/constants';
import { HttpError, ok, parseJson, requireAdmin } from '../../../lib/http';
import { isMissingCategoryColumnError, withDerivedServiceCategory } from '../../../lib/serviceCategory';
import type { Env } from '../../../lib/types';

const idSchema = z.coerce.number().int().positive();

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().min(2).optional(),
  description: z.string().min(2).optional(),
  price_cents: z.number().int().nonnegative().optional(),
  duration_minutes: z.number().int().positive().optional(),
  category: z.enum(CANONICAL_CATEGORY_SLUGS).nullable().optional(),
  active: z.boolean().optional(),
  sort_order: z.number().int().nonnegative().optional(),
});

export const onRequestPut: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const id = idSchema.parse(context.params.id);
  const payload = await parseJson(context.request, updateSchema);

  let result;
  try {
    result = await context.env.LNAPAGES_DB.prepare(
      `UPDATE items
       SET name = COALESCE(?, name),
           slug = COALESCE(?, slug),
           description = COALESCE(?, description),
           price_cents = COALESCE(?, price_cents),
           duration_minutes = COALESCE(?, duration_minutes),
           category = COALESCE(?, category),
           active = COALESCE(?, active),
           sort_order = COALESCE(?, sort_order),
           updated_at = datetime('now')
       WHERE id = ? AND type IN ('service','bundle')`,
    )
      .bind(
        payload.name ?? null,
        payload.slug ?? null,
        payload.description ?? null,
        payload.price_cents ?? null,
        payload.duration_minutes ?? null,
        payload.category === undefined ? null : payload.category,
        payload.active === undefined ? null : (payload.active ? 1 : 0),
        payload.sort_order ?? null,
        id,
      )
      .run();
  } catch (error) {
    if (!isMissingCategoryColumnError(error)) throw error;
    result = await context.env.LNAPAGES_DB.prepare(
      `UPDATE items
       SET name = COALESCE(?, name),
           slug = COALESCE(?, slug),
           description = COALESCE(?, description),
           price_cents = COALESCE(?, price_cents),
           duration_minutes = COALESCE(?, duration_minutes),
           active = COALESCE(?, active),
           sort_order = COALESCE(?, sort_order),
           updated_at = datetime('now')
       WHERE id = ? AND type IN ('service','bundle')`,
    )
      .bind(
        payload.name ?? null,
        payload.slug ?? null,
        payload.description ?? null,
        payload.price_cents ?? null,
        payload.duration_minutes ?? null,
        payload.active === undefined ? null : (payload.active ? 1 : 0),
        payload.sort_order ?? null,
        id,
      )
      .run();
  }

  if (!result.meta.changes) {
    throw new HttpError(404, 'NOT_FOUND', 'Service not found');
  }

  let updated = null;
  try {
    updated = await context.env.LNAPAGES_DB.prepare(
      `SELECT id, slug, name, description, duration_minutes, price_cents, category, active, sort_order, created_at, updated_at
       FROM items WHERE id = ? AND type IN ('service','bundle')`,
    ).bind(id).first();
  } catch (error) {
    if (!isMissingCategoryColumnError(error)) throw error;
    const fallback = await context.env.LNAPAGES_DB.prepare(
      `SELECT id, slug, name, description, duration_minutes, price_cents, active, sort_order, created_at, updated_at
       FROM items WHERE id = ? AND type IN ('service','bundle')`,
    ).bind(id).first<Record<string, unknown>>();
    updated = fallback ? withDerivedServiceCategory([fallback])[0] : null;
  }

  return ok(updated);
};
