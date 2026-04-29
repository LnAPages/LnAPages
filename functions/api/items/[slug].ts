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
  touchServicesVersion,
  getServicesVersion,
  noStoreHeaders,
} from '../../lib/servicesVersion';

/**
 * /api/items/:slug
 *
 * GET    — public. 404 if not found. For type=product also requires has_page=1
 *          (products without a page are admin-only and hidden from public routes).
 * PATCH  — admin only. Partial update. Bumps services version.
 * DELETE — admin only. Soft-disable by setting active=0 unless ?hard=1 is passed;
 *          hard delete only if no bookings reference this item.
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

const UpdateItemSchema = z.object({
  type: z.enum(['service', 'product']).optional(),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase-kebab-case')
    .optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  billingMode: z.enum(['one_time', 'hourly', 'monthly_retainer']).optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  priceCents: z.number().int().nonnegative().optional(),
  depositCents: z.number().int().nonnegative().optional(),
  addonOfItemId: z.number().int().positive().nullable().optional(),
  stripePriceId: z.string().max(200).nullable().optional(),
  active: z.boolean().optional(),
  hasPage: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

function getSlugParam(context: { params: Record<string, string | string[]> }): string {
  const raw = context.params?.slug;
  return Array.isArray(raw) ? raw[0] : (raw ?? '');
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const slug = getSlugParam(context);
    if (!slug) return fail(400, 'bad_request', 'Missing slug');

    const row = await context.env.FNLSTG_DB.prepare(
      'SELECT * FROM items WHERE slug = ? AND active = 1',
    )
      .bind(slug)
      .first<ItemRow>();

    if (!row) return fail(404, 'not_found', 'Item not found');

    // Products without a page are admin-only.
    if (row.type === 'product' && row.has_page === 0) {
      return fail(404, 'not_found', 'Item not found');
    }

    const version = await getServicesVersion(context.env);

    return ok({ item: serializeItem(row) }, 200, {
      ...noStoreHeaders,
      'x-services-version': version,
    });
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.code, err.message);
    console.error('[GET /api/items/:slug]', err);
    return fail(500, 'internal_error', 'Failed to load item');
  }
};

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  try {
    await requireAdmin(context);
    const slug = getSlugParam(context);
    if (!slug) return fail(400, 'bad_request', 'Missing slug');

    const body = await parseJson(context.request, UpdateItemSchema);

    const existing = await context.env.FNLSTG_DB.prepare(
      'SELECT * FROM items WHERE slug = ?',
    )
      .bind(slug)
      .first<ItemRow>();

    if (!existing) return fail(404, 'not_found', 'Item not found');

    const nextType = body.type ?? existing.type;
    const nextHasPage = body.hasPage ?? existing.has_page === 1;

    if (nextType === 'product' && nextHasPage) {
      return fail(400, 'invalid_item', 'Products cannot have their own page');
    }

    if (body.addonOfItemId != null) {
      if (body.addonOfItemId === existing.id) {
        return fail(400, 'invalid_addon', 'An item cannot be an add-on of itself');
      }
      const parent = await context.env.FNLSTG_DB.prepare(
        'SELECT id FROM items WHERE id = ?',
      )
        .bind(body.addonOfItemId)
        .first();
      if (!parent) {
        return fail(400, 'invalid_addon', 'addonOfItemId does not reference an existing item');
      }
    }

    const fields: string[] = [];
    const binds: unknown[] = [];
    const add = (col: string, val: unknown) => {
      fields.push(col + ' = ?');
      binds.push(val);
    };

    if (body.type !== undefined) add('type', body.type);
    if (body.slug !== undefined) add('slug', body.slug);
    if (body.name !== undefined) add('name', body.name);
    if (body.description !== undefined) add('description', body.description);
    if (body.billingMode !== undefined) add('billing_mode', body.billingMode);
    if (body.durationMinutes !== undefined) add('duration_minutes', body.durationMinutes);
    if (body.priceCents !== undefined) add('price_cents', body.priceCents);
    if (body.depositCents !== undefined) add('deposit_cents', body.depositCents);
    if (body.addonOfItemId !== undefined) add('addon_of_item_id', body.addonOfItemId);
    if (body.stripePriceId !== undefined) add('stripe_price_id', body.stripePriceId);
    if (body.active !== undefined) add('active', body.active ? 1 : 0);
    if (body.hasPage !== undefined) add('has_page', body.hasPage ? 1 : 0);
    if (body.sortOrder !== undefined) add('sort_order', body.sortOrder);

    if (fields.length === 0) {
      // No-op update; still return the current row for client convenience.
      const version = await getServicesVersion(context.env);
      return ok({ item: serializeItem(existing) }, 200, {
        ...noStoreHeaders,
        'x-services-version': version,
      });
    }

    fields.push("updated_at = datetime('now')");

    const sql = 'UPDATE items SET ' + fields.join(', ') + ' WHERE id = ?';
    binds.push(existing.id);

    const result = await context.env.FNLSTG_DB.prepare(sql).bind(...binds).run();
    if (!result.success) {
      return fail(409, 'slug_conflict', 'Update failed (likely a slug collision)');
    }

    const updated = await context.env.FNLSTG_DB.prepare(
      'SELECT * FROM items WHERE id = ?',
    )
      .bind(existing.id)
      .first<ItemRow>();

    const version = await touchServicesVersion(context.env);

    return ok(
      { item: updated ? serializeItem(updated) : null },
      200,
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
    console.error('[PATCH /api/items/:slug]', err);
    return fail(500, 'internal_error', 'Failed to update item');
  }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    await requireAdmin(context);
    const slug = getSlugParam(context);
    if (!slug) return fail(400, 'bad_request', 'Missing slug');

    const url = new URL(context.request.url);
    const hard = url.searchParams.get('hard') === '1';

    const existing = await context.env.FNLSTG_DB.prepare(
      'SELECT * FROM items WHERE slug = ?',
    )
      .bind(slug)
      .first<ItemRow>();

    if (!existing) return fail(404, 'not_found', 'Item not found');

    if (hard) {
      const bookingCount = await context.env.FNLSTG_DB.prepare(
        'SELECT COUNT(*) as n FROM bookings WHERE item_id = ?',
      )
        .bind(existing.id)
        .first<{ n: number }>();
      if ((bookingCount?.n ?? 0) > 0) {
        return fail(
          409,
          'item_has_bookings',
          'Cannot hard-delete an item that has bookings. Soft-disable instead (active=false).',
        );
      }
      await context.env.FNLSTG_DB.prepare('DELETE FROM items WHERE id = ?')
        .bind(existing.id)
        .run();
    } else {
      await context.env.FNLSTG_DB.prepare(
        "UPDATE items SET active = 0, updated_at = datetime('now') WHERE id = ?",
      )
        .bind(existing.id)
        .run();
    }

    const version = await touchServicesVersion(context.env);

    return ok(
      { deleted: true, hard },
      200,
      {
        ...noStoreHeaders,
        'x-services-version': version,
      },
    );
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.code, err.message);
    console.error('[DELETE /api/items/:slug]', err);
    return fail(500, 'internal_error', 'Failed to delete item');
  }
};
