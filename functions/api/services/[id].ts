import { z } from 'zod';
import { serviceUpdateSchema } from '../../../shared/schemas/service';
import { HttpError, ok, parseJson, requireAdmin } from '../../lib/http';
import { isMissingCategoryColumnError, withDerivedServiceCategory } from '../../lib/serviceCategory';
import { getServicesVersion, noStoreHeaders, touchServicesVersion } from '../../lib/servicesVersion';
import { attachTalentsToOne, setServiceTalents } from '../../lib/serviceTalents';
import type { Env } from '../../lib/types';

// Back-compat shim: /api/services/:id now targets items table (type IN service/bundle).
const idSchema = z.coerce.number().int().positive();
const SERVICE_TYPES = "'service','bundle'";

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const id = idSchema.parse(params.id);
  let row = null;
  try {
    row = await env.LNAPAGES_DB.prepare(
      `SELECT id, slug, name, description, duration_minutes, price_cents, price_unit, active, sort_order, category, created_at, updated_at
       FROM items WHERE id = ? AND type IN (${SERVICE_TYPES})`,
    ).bind(id).first<Record<string, unknown>>();
  } catch (error) {
    if (!isMissingCategoryColumnError(error)) throw error;
    const fallback = await env.LNAPAGES_DB.prepare(
      `SELECT id, slug, name, description, duration_minutes, price_cents, active, sort_order, created_at, updated_at
       FROM items WHERE id = ? AND type IN (${SERVICE_TYPES})`,
    ).bind(id).first<Record<string, unknown>>();
    row = fallback ? withDerivedServiceCategory([fallback])[0] : null;
  }
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Service not found');
  row = await attachTalentsToOne(env, row);
  const version = await getServicesVersion(env);
  return ok(row, 200, { ...noStoreHeaders, 'X-Services-Version': version });
};

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const { env, params, request } = context;
  const id = idSchema.parse(params.id);
  const payload = await parseJson(request, serviceUpdateSchema);
  try {
    await env.LNAPAGES_DB.prepare(
      `UPDATE items
       SET slug = COALESCE(?, slug),
           name = COALESCE(?, name),
           description = COALESCE(?, description),
           duration_minutes = COALESCE(?, duration_minutes),
           price_cents = COALESCE(?, price_cents),
           price_unit = COALESCE(?, price_unit),
           active = COALESCE(?, active),
           sort_order = COALESCE(?, sort_order),
           category = COALESCE(?, category),
           updated_at = datetime('now')
       WHERE id = ? AND type IN (${SERVICE_TYPES})`,
    )
      .bind(
        payload.slug ?? null,
        payload.name ?? null,
        payload.description ?? null,
        payload.duration_minutes ?? null,
        payload.price_cents ?? null,
        payload.price_unit ?? null,
        payload.active == null ? null : (payload.active ? 1 : 0),
        payload.sort_order ?? null,
        payload.category ?? null,
        id,
      )
      .run();
  } catch (error) {
    if (!isMissingCategoryColumnError(error)) throw error;
    await env.LNAPAGES_DB.prepare(
      `UPDATE items
       SET slug = COALESCE(?, slug),
           name = COALESCE(?, name),
           description = COALESCE(?, description),
           duration_minutes = COALESCE(?, duration_minutes),
           price_cents = COALESCE(?, price_cents),
           active = COALESCE(?, active),
           sort_order = COALESCE(?, sort_order),
           updated_at = datetime('now')
       WHERE id = ? AND type IN (${SERVICE_TYPES})`,
    )
      .bind(
        payload.slug ?? null,
        payload.name ?? null,
        payload.description ?? null,
        payload.duration_minutes ?? null,
        payload.price_cents ?? null,
        payload.active == null ? null : (payload.active ? 1 : 0),
        payload.sort_order ?? null,
        id,
      )
      .run();
  }

  if (payload.talents !== undefined) {
    await setServiceTalents(env, id, payload.talents ?? []);
  }

  let updated: Record<string, unknown> | null = null;
  try {
    updated = await env.LNAPAGES_DB.prepare(
      `SELECT id, slug, name, description, duration_minutes, price_cents, price_unit, active, sort_order, category, created_at, updated_at
       FROM items WHERE id = ? AND type IN (${SERVICE_TYPES})`,
    ).bind(id).first<Record<string, unknown>>();
  } catch (error) {
    if (!isMissingCategoryColumnError(error)) throw error;
    const fallback = await env.LNAPAGES_DB.prepare(
      `SELECT id, slug, name, description, duration_minutes, price_cents, active, sort_order, created_at, updated_at
       FROM items WHERE id = ? AND type IN (${SERVICE_TYPES})`,
    ).bind(id).first<Record<string, unknown>>();
    updated = fallback ? withDerivedServiceCategory([fallback])[0] : null;
  }
  if (!updated) throw new HttpError(404, 'NOT_FOUND', 'Service not found');
  updated = await attachTalentsToOne(env, updated);
  const version = await touchServicesVersion(env);
  return ok(updated, 200, { ...noStoreHeaders, 'X-Services-Version': version });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const { env, params } = context;
  const id = idSchema.parse(params.id);
  const result = await env.LNAPAGES_DB.prepare(
    `DELETE FROM items WHERE id = ? AND type IN (${SERVICE_TYPES})`,
  ).bind(id).run();
  if (!result.meta.changes) throw new HttpError(404, 'NOT_FOUND', 'Service not found');
  const version = await touchServicesVersion(env);
  return ok({ id }, 200, { ...noStoreHeaders, 'X-Services-Version': version });
};
