// functions/api/services/index.ts
// Back-compat shim: the admin UI (Services.tsx) and legacy clients call /api/services,
// but after migration 0004 the underlying table is `items`. We read/write `items` and
// expose a `services`-shaped payload (type IN service/bundle; products/addons via /api/items).
import { serviceCreateSchema } from '../../../shared/schemas/service';
import { parseJson, ok, requireAdmin } from '../../lib/http';
import { isMissingCategoryColumnError, isMissingColumnError, isMissingTableError, withDerivedServiceCategory } from '../../lib/serviceCategory';
import { BASE_SERVICE_COLUMNS, CATEGORY_SERVICE_COLUMNS, prefixColumns } from '../../lib/serviceColumns';
import { getServicesVersion, noStoreHeaders, touchServicesVersion } from '../../lib/servicesVersion';
import { attachTalents, setServiceTalents } from '../../lib/serviceTalents';
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
  const talentFilter = url.searchParams.get('talent');
  if (includeAll) {
    await requireAdmin(context);
  }

  let results: Array<Record<string, unknown>>;
  try {
    if (talentFilter) {
      // Filter by talent slug via service_talents join table
      const activeClause = includeAll ? '' : 'AND s.active = 1';
      const sql = `SELECT ${prefixColumns(CATEGORY_SERVICE_COLUMNS, 's')}
         FROM items s
         JOIN service_talents st ON st.service_id = s.id
         WHERE s.type IN (${SERVICE_TYPES}) ${activeClause} AND st.talent_slug = ?
         ORDER BY s.sort_order, s.id`;
      const query = await env.LNAPAGES_DB.prepare(sql).bind(talentFilter).all<Record<string, unknown>>();
      results = query.results;
    } else {
      const where = buildServicesWhere(includeAll);
      const sql = `SELECT ${CATEGORY_SERVICE_COLUMNS} FROM items ${where} ORDER BY sort_order, id`;
      const query = await env.LNAPAGES_DB.prepare(sql).all<Record<string, unknown>>();
      results = query.results;
    }
  } catch (error) {
    if (isMissingCategoryColumnError(error)) {
      const where = buildServicesWhere(includeAll);
      const fallbackSql = `SELECT ${BASE_SERVICE_COLUMNS} FROM items ${where} ORDER BY sort_order, id`;
      const query = await env.LNAPAGES_DB.prepare(fallbackSql).all<Record<string, unknown>>();
      results = withDerivedServiceCategory(query.results);
    } else if (isMissingTableError(error, 'service_talents') && talentFilter) {
      // service_talents table not yet migrated — return all active services unfiltered
      const where = buildServicesWhere(includeAll);
      try {
        const sql = `SELECT ${CATEGORY_SERVICE_COLUMNS} FROM items ${where} ORDER BY sort_order, id`;
        const query = await env.LNAPAGES_DB.prepare(sql).all<Record<string, unknown>>();
        results = query.results;
      } catch (innerError) {
        if (!isMissingCategoryColumnError(innerError)) throw innerError;
        const fallbackSql = `SELECT ${BASE_SERVICE_COLUMNS} FROM items ${where} ORDER BY sort_order, id`;
        const query = await env.LNAPAGES_DB.prepare(fallbackSql).all<Record<string, unknown>>();
        results = withDerivedServiceCategory(query.results);
      }
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

  results = await attachTalents(env, results);
  const version = await getServicesVersion(env);
  return ok(results, 200, { ...noStoreHeaders, 'X-Services-Version': version });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const payload = await parseJson(context.request, serviceCreateSchema);
  let result;
  try {
    result = await context.env.LNAPAGES_DB.prepare(
      `INSERT INTO items (type, slug, name, description, billing_mode, duration_minutes, price_cents, price_unit, deposit_cents, active, has_page, sort_order, category, created_at, updated_at)
       VALUES ('service', ?, ?, ?, 'fixed', ?, ?, ?, 0, ?, 1, ?, ?, datetime('now'), datetime('now'))`,
    )
      .bind(
        payload.slug,
        payload.name,
        payload.description,
        payload.duration_minutes,
        payload.price_cents,
        payload.price_unit ?? null,
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

  const serviceId = Number(result.meta.last_row_id ?? 0);
  if (payload.talents && payload.talents.length > 0) {
    await setServiceTalents(context.env, serviceId, payload.talents);
  }

  const version = await touchServicesVersion(context.env);
  return ok(
    { id: serviceId, ...payload },
    201,
    { ...noStoreHeaders, 'X-Services-Version': version },
  );
};
