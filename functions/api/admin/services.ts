import { ok, requireAdmin } from '../../lib/http';
import { isMissingCategoryColumnError, isMissingColumnError, isMissingTableError, withDerivedServiceCategory } from '../../lib/serviceCategory';
import { BASE_SERVICE_COLUMNS, CATEGORY_SERVICE_COLUMNS } from '../../lib/serviceColumns';
import { attachTalents } from '../../lib/serviceTalents';
import type { Env } from '../../lib/types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  let results: Array<Record<string, unknown>>;
  try {
    const query = await context.env.LNAPAGES_DB.prepare(
      `SELECT ${CATEGORY_SERVICE_COLUMNS}
       FROM items
       WHERE type IN ('service','bundle')
       ORDER BY sort_order, id`,
    ).all<Record<string, unknown>>();
    results = query.results;
  } catch (error) {
    if (isMissingCategoryColumnError(error)) {
      const query = await context.env.LNAPAGES_DB.prepare(
        `SELECT ${BASE_SERVICE_COLUMNS}
         FROM items
         WHERE type IN ('service','bundle')
         ORDER BY sort_order, id`,
      ).all<Record<string, unknown>>();
      results = withDerivedServiceCategory(query.results);
    } else if (isMissingTableError(error, 'items')) {
      try {
        const query = await context.env.LNAPAGES_DB.prepare(
          `SELECT ${BASE_SERVICE_COLUMNS}
           FROM services
           WHERE type IN ('service','bundle')
           ORDER BY sort_order, id`,
        ).all<Record<string, unknown>>();
        results = withDerivedServiceCategory(query.results);
      } catch (legacyError) {
        if (!isMissingColumnError(legacyError, 'type')) throw legacyError;
        const query = await context.env.LNAPAGES_DB.prepare(
          `SELECT ${BASE_SERVICE_COLUMNS}
           FROM services
           ORDER BY sort_order, id`,
        ).all<Record<string, unknown>>();
        results = withDerivedServiceCategory(query.results);
      }
    } else {
      throw error;
    }
  }
  results = await attachTalents(context.env, results);
  return ok(results);
};
