import { fail, ok } from '../../lib/http';
import { parseProductTagsJson } from '../../lib/products';
import { isShopEnabled } from '../../lib/shop';
import type { Env } from '../../lib/types';

function toProductKind(value: unknown): 'digital' | 'apparel' | '3d' | 'shipped' {
  if (value === 'digital' || value === 'apparel' || value === '3d' || value === 'shipped') {
    return value;
  }
  return 'digital';
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!(await isShopEnabled(env))) {
    return fail(404, 'NOT_FOUND', 'Shop is disabled');
  }
  const { results } = await env.FNLSTG_DB.prepare(
    `SELECT p.id,
            p.slug,
            p.name,
            p.description,
            p.price_cents,
            p.kind,
            p.r2_key,
            COALESCE(
              (SELECT json_group_array(pt.tag) FROM product_tags pt WHERE pt.product_id = p.id),
              '[]'
            ) AS tags_json
     FROM products p
     WHERE p.active = 1
     ORDER BY p.id DESC`,
  ).all<Record<string, unknown>>();
  return ok(
    (results ?? []).map((row) => ({
      id: Number(row.id),
      slug: String(row.slug ?? ''),
      name: String(row.name ?? ''),
      description: row.description ? String(row.description) : null,
      price_cents: Number(row.price_cents ?? 0),
      kind: toProductKind(row.kind),
      r2_key: row.r2_key ? String(row.r2_key) : null,
      tags: parseProductTagsJson(row.tags_json),
    })),
  );
};
