import { z } from 'zod';
import { ok, parseJson, requireAdmin } from '../../../lib/http';
import { ensureUniqueProductSlug } from '../../../lib/products';
import type { Env } from '../../../lib/types';

const kindSchema = z.enum(['digital', 'apparel', '3d', 'shipped']);
const createSchema = z.object({
  slug: z.string().min(2),
  name: z.string().min(2),
  description: z.string().optional(),
  price_cents: z.number().int().nonnegative(),
  kind: kindSchema.optional(), fulfillment_type: z.enum(['digital', 'shipment', 'pickup']).optional(), pickup_instructions: z.string().nullable().optional(),
  r2_key: z.string().optional(),
  active: z.boolean().optional().default(true),
});

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const { results } = await context.env.LNAPAGES_DB.prepare(
    'SELECT id, slug, name, description, price_cents, kind, fulfillment_type, pickup_instructions, r2_key, active, created_at FROM products ORDER BY id DESC',
  ).all();
  return ok(results);
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const payload = await parseJson(context.request, createSchema);
  const slug = await ensureUniqueProductSlug(context.env.LNAPAGES_DB, payload.slug || payload.name);
  const result = await context.env.LNAPAGES_DB.prepare(
    `INSERT INTO products (slug, name, description, price_cents, kind, fulfillment_type, pickup_instructions, r2_key, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      slug,
      payload.name,
      payload.description ?? null,
      payload.price_cents,
      payload.kind ?? (payload.fulfillment_type === 'digital' ? 'digital' : 'shipped'), payload.fulfillment_type ?? 'digital', payload.pickup_instructions ?? null,
      payload.r2_key ?? null,
      payload.active ? 1 : 0,
    )
    .run();
  return ok({ id: Number(result.meta.last_row_id ?? 0), ...payload, slug }, 201);
};
