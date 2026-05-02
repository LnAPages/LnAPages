import { z } from 'zod';
import { HttpError, ok, parseJson, requireAdmin } from '../../../../lib/http';
import { ensureUniqueProductSlug } from '../../../../lib/products';
import type { Env } from '../../../../lib/types';

const idSchema = z.coerce.number().int().positive();
const updateSchema = z.object({
  slug: z.string().min(2).optional(),
  name: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  price_cents: z.number().int().nonnegative().optional(),
  kind: z.enum(['digital', 'apparel', '3d', 'shipped']).optional(), fulfillment_type: z.enum(['digital', 'shipment', 'pickup']).optional(), pickup_instructions: z.string().nullable().optional(),
  r2_key: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export const onRequestPut: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const id = idSchema.parse(context.params.id);
  const payload = await parseJson(context.request, updateSchema);
  const slug = payload.slug ? await ensureUniqueProductSlug(context.env.LNAPAGES_DB, payload.slug, id) : null;
  const result = await context.env.LNAPAGES_DB.prepare(
    `UPDATE products
     SET slug = COALESCE(?, slug),
         name = COALESCE(?, name),
         description = COALESCE(?, description),
         price_cents = COALESCE(?, price_cents),
         kind = COALESCE(?, kind),
         r2_key = COALESCE(?, r2_key),
         active = COALESCE(?, active)
     WHERE id = ?`,
  )
    .bind(
      slug,
      payload.name ?? null,
      payload.description ?? null,
      payload.price_cents ?? null,
      payload.kind ?? null,
      payload.r2_key ?? null,
      payload.active === undefined ? null : (payload.active ? 1 : 0),
      id,
    )
    .run();
  if (!result.meta.changes) throw new HttpError(404, 'NOT_FOUND', 'Product not found');
  const updated = await context.env.LNAPAGES_DB.prepare(
    'SELECT id, slug, name, description, price_cents, kind, r2_key, active, created_at FROM products WHERE id = ?',
  ).bind(id).first();
  return ok(updated);
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const id = idSchema.parse(context.params.id);
  await context.env.LNAPAGES_DB.prepare('DELETE FROM product_tags WHERE product_id = ?').bind(id).run();
  const result = await context.env.LNAPAGES_DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  if (!result.meta.changes) throw new HttpError(404, 'NOT_FOUND', 'Product not found');
  return ok({ id });
};
