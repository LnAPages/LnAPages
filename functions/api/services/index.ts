// functions/api/services/index.ts
// Back-compat shim: the admin UI (Services.tsx) and legacy clients call /api/services,
// but after migration 0004 the underlying table is `items`. We read/write `items` and
// expose a `services`-shaped payload (type IN service/bundle; products/addons via /api/items).
import { serviceCreateSchema } from '../../../shared/schemas/service';
import { parseJson, ok, requireAdmin } from '../../lib/http';
import { isMissingCategoryColumnError, isMissingColumnError, isMissingTableError, withDerivedServiceCategory } from '../../lib/serviceCategory';
import { BASE_SERVICE_COLUMNS, CATEGORY_SERVICE_COLUMNS } from '../../lib/serviceColumns';
import { getServicesVersion, noStoreHeaders, touchServicesVersion } from '../../lib/servicesVersion';
import type { Env } from '../../lib/types';

const SERVICE_TYPES = "'service','bundle'";

function buildServicesWhere(includeAll: boolean): string {
  return includeAll
    ? `WHERE type IN (${SERVICE_TYPES})`
    : `WHERE type IN (${SERVICE_TYPES}) AND active = 1`;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);
  const includeAll = url.searchParams.get('all') === '1';
  if (includeAll) {
    await requireAdmin(context);
  }
  const where = buildServicesWhere(includeAll);
  let results: Array<Record<string, unknown>>;
  try {
    const sql = `SELECT ${CATEGORY_SERVICE_COLUMNS} FROM items ${where} ORDER BY sort_order, id`;
    const query = await env.LNAPAGES_DB.prepare(sql).all<Record<string, unknown>>();
    results = query.results;
  } catch (error) {
    if (isMissingCategoryColumnError(error)) {
      const fallbackSql = `SELECT ${BASE_SERVICE_COLUMNS} FROM items ${where} ORDER BY sort_order, id`;
      const query = await env.LNAPAGES_DB.prepare(fallbackSql).all<Record<string, unknown>>();
      results = withDerivedServiceCategory(query.results);
    } else if (isMissingTableError(error, 'items')) {
      const legacyWhereWithType = buildServicesWhere(includeAll);
      try {
        const legacySql = `SELECT ${BASE_SERVICE_COLUMNS} FROM services ${legacyWhereWithType} ORDER BY sort_order, id`;
        const query = await env.LNAPAGES_DB.prepare(legacySql).all<Record<string, unknown>>();
        results = withDerivedServiceCategory(query.results);
      } catch (legacyError) {
        if (!isMissingColumnError(legacyError, 'type')) throw legacyError;
        const legacyWhere = includeAll ? '' : 'WHERE active = 1';
        const legacySql = `SELECT ${BASE_SERVICE_COLUMNS} FROM services ${legacyWhere} ORDER BY sort_order, id`;
        const query = await env.LNAPAGES_DB.prepare(legacySql).all<Record<string, unknown>>();
        results = withDerivedServiceCategory(query.results);
      }
    } else {
      throw error;
    }
  }
  const version = await getServicesVersion(env);
  return ok(results, 200, { ...noStoreHeaders, 'X-Services-Version': version });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const payload = await parseJson(context.request, serviceCreateSchema);
  let result;
  try {
    result = await context.env.LNAPAGES_DB.prepare(
      `INSERT INTO items (type, slug, name, description, billing_mode, duration_minutes, price_cents, deposit_cents, active, has_page, sort_order, category, created_at, updated_at)
       VALUES ('service', ?, ?, ?, 'fixed', ?, ?, 0, ?, 1, ?, ?, datetime('now'), datetime('now'))`,
    )
      .bind(
        payload.slug,
        payload.name,
        payload.description,
        payload.duration_minutes,
        payload.price_cents,
        payload.active ? 1 : 0,
        payload.sort_order,
        payload.category ?? null,
      )
      .run();
  } catch (error) {
    if (!isMissingCategoryColumnError(error)) throw error;
    result = await context.env.LNAPAGES_DB.prepare(
      `INSERT INTO items (type, slug, name, description, billing_mode, duration_minutes, price_cents, deposit_cents, active, has_page, sort_order, created_at, updated_at)
       VALUES ('service', ?, ?, ?, 'fixed', ?, ?, 0, ?, 1, ?, datetime('now'), datetime('now'))`,
    )
      .bind(
        payload.slug,
        payload.name,
        payload.description,
        payload.duration_minutes,
        payload.price_cents,
        payload.active ? 1 : 0,
        payload.sort_order,
      )
      .run();
  }

  const version = await touchServicesVersion(context.env);
  return ok(
    { id: Number(result.meta.last_row_id ?? 0), ...payload },
    201,
    { ...noStoreHeaders, 'X-Services-Version': version },
  );
};
