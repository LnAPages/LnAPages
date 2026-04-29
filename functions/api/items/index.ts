import { z } from 'zod';
import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env } from '../../lib/types';
import {
  ok,
  fail,
  parseJson,
  requireAdmin,
  HttpError,
} from '../../lib/http';
import {
  getServicesVersion,
  touchServicesVersion,
  noStoreHeaders,
} from '../../lib/servicesVersion';

/**
 * /api/items
 *
 * GET  — public list of items. Filters:
 *          ?type=service|product (defaults to both)
 *          ?active=1 (defaults to 1; admin can pass 0 to include inactive)
 *        Sends x-services-version header so clients can cache-bust.
 * POST  — admin only. Create a new item.
 *
 * Items are the unified model for services and products. See docs/SCHEMA.md.
 */

type ItemRow = {
  id: number;
  type: 'service' | 'product';
  slug: string;
  name: string;
  description: string | null;
  billing_mode: 'one_time' | 'hourly' | 'monthly_retainer';
  duration_minutes: number | null;
  price_cents: number;
  deposit_cents: number;
  addon_of_item_id: number | null;
  stripe_price_id: string | null;
  active: number;
  has_page: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function serializeItem(row: ItemRow) {
  return {
    id: row.id,
    type: row.type,
    slug: row.slug,
    name: row.name,
    description: row.description,
    billingMode: row.billing_mode,
    durationMinutes: row.duration_minutes,
    priceCents: row.price_cents,
    depositCents: row.deposit_cents,
    addonOfItemId: row.addon_of_item_id,
    stripePriceId: row.stripe_price_id,
    active: row.active === 1,
    hasPage: row.has_page === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CreateItemSchema = z.object({
  type: z.enum(['service', 'product']),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase-kebab-case'),
  name: z.string().min(1).max(200),
  description: z.string().max(4000).nullish(),
  billingMode: z
    .enum(['one_time', 'hourly', 'monthly_retainer'])
    .default('one_time'),
  durationMinutes: z.number().int().positive().nullish(),
  priceCents: z.number().int().nonnegative().default(0),
  depositCents: z.number().int().nonnegative().default(0),
  addonOfItemId: z.number().int().positive().nullish(),
  stripePriceId: z.string().max(200).nullish(),
  active: z.boolean().default(true),
  hasPage: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const typeParam = url.searchParams.get('type');
    const activeParam = url.searchParams.get('active');

    const where: string[] = [];
    const binds: unknown[] = [];

    if (typeParam === 'service' || typeParam === 'product') {
      where.push('type = ?');
      binds.push(typeParam);
    }

    // Default to active-only for unauthenticated callers. Admin can pass ?active=0.
    if (activeParam !== '0') {
      where.push('active = 1');
    }

    const sql =
      'SELECT * FROM items' +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      ' ORDER BY sort_order ASC, id ASC';

    const { results } = await context.env.FNLSTG_DB.prepare(sql)
      .bind(...binds)
      .all<ItemRow>();

    const version = await getServicesVersion(context.env);

    return ok(
      { items: (results ?? []).map(serializeItem) },
      200,
      {
        ...noStoreHeaders,
        'x-services-version': version,
      },
    );
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.code, err.message);
    console.error('[GET /api/items]', err);
    return fail(500, 'internal_error', 'Failed to list items');
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    await requireAdmin(context);
    const body = await parseJson(context.request, CreateItemSchema);

    // Guard: products cannot have has_page=true (admin UI should also enforce).
    if (body.type === 'product' && body.hasPage) {
      return fail(
        400,
        'invalid_item',
        'Products cannot have their own page (hasPage must be false for type=product).',
      );
    }

    // Guard: add-ons must reference an existing item.
    if (body.addonOfItemId != null) {
      const parent = await context.env.FNLSTG_DB.prepare(
        'SELECT id FROM items WHERE id = ?',
      )
        .bind(body.addonOfItemId)
        .first();
      if (!parent) {
        return fail(400, 'invalid_addon', 'addonOfItemId does not reference an existing item');
      }
    }

    const now = new Date().toISOString();

    const insert = await context.env.FNLSTG_DB.prepare(
      `INSERT INTO items (
        type, slug, name, description,
        billing_mode, duration_minutes, price_cents, deposit_cents,
        addon_of_item_id, stripe_price_id, active, has_page, sort_order,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        body.type,
        body.slug,
        body.name,
        body.description ?? null,
        body.billingMode,
        body.durationMinutes ?? null,
        body.priceCents,
        body.depositCents,
        body.addonOfItemId ?? null,
        body.stripePriceId ?? null,
        body.active ? 1 : 0,
        body.hasPage ? 1 : 0,
        body.sortOrder,
        now,
        now,
      )
      .run();

    if (!insert.success) {
      // Most common cause: UNIQUE(slug) collision.
      return fail(409, 'slug_conflict', 'An item with that slug already exists');
    }

    const created = await context.env.FNLSTG_DB.prepare(
      'SELECT * FROM items WHERE id = ?',
    )
      .bind(insert.meta.last_row_id)
      .first<ItemRow>();

    const version = await touchServicesVersion(context.env);

    return ok(
      { item: created ? serializeItem(created) : null },
      201,
      {
        ...noStoreHeaders,
        'x-services-version': version,
      },
    );
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.code, err.message);
    if (err instanceof z.ZodError) {
      return fail(400, 'validation_error', err.issues.map((i) => i.message).join('; '));
    }
    console.error('[POST /api/items]', err);
    return fail(500, 'internal_error', 'Failed to create item');
  }
};
