import type { Env } from './types';

/** Fetches talents for a list of services and attaches them as `talents: string[]`. */
export async function attachTalents(
  env: Env,
  services: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  if (services.length === 0) return services;
  try {
    const ids = services.map((s) => s.id as number);
    const placeholders = ids.map(() => '?').join(',');
    const { results } = await env.LNAPAGES_DB.prepare(
      `SELECT service_id, talent_slug FROM service_talents WHERE service_id IN (${placeholders}) ORDER BY service_id, sort_order`,
    )
      .bind(...ids)
      .all<{ service_id: number; talent_slug: string }>();

    const talentMap = new Map<number, string[]>();
    for (const row of results) {
      const arr = talentMap.get(row.service_id) ?? [];
      arr.push(row.talent_slug);
      talentMap.set(row.service_id, arr);
    }

    return services.map((s) => ({
      ...s,
      talents: talentMap.get(s.id as number) ?? [],
    }));
  } catch {
    // service_talents table might not exist yet (pre-migration)
    return services.map((s) => ({ ...s, talents: [] }));
  }
}

/** Fetches talents for a single service row. */
export async function attachTalentsToOne(
  env: Env,
  service: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const [result] = await attachTalents(env, [service]);
  return result;
}

/**
 * Replace-set the talent slugs for a service.
 * Deletes all existing rows then inserts the new list within a D1 batch.
 */
export async function setServiceTalents(
  env: Env,
  serviceId: number,
  talents: string[],
): Promise<void> {
  try {
    const statements = [
      env.LNAPAGES_DB.prepare('DELETE FROM service_talents WHERE service_id = ?').bind(serviceId),
      ...talents.map((slug, i) =>
        env.LNAPAGES_DB.prepare(
          'INSERT OR IGNORE INTO service_talents (service_id, talent_slug, sort_order) VALUES (?, ?, ?)',
        ).bind(serviceId, slug, i),
      ),
    ];
    await env.LNAPAGES_DB.batch(statements);
  } catch {
    // service_talents table might not exist yet (pre-migration) — silently skip
  }
}
