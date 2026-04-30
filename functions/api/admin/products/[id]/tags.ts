import { z } from 'zod';
import { HttpError, ok, parseJson, requireAdmin } from '../../../../lib/http';
import { normalizeProductTags } from '../../../../lib/products';
import type { Env } from '../../../../lib/types';

const idSchema = z.coerce.number().int().positive();
const updateSchema = z.object({
  tags: z.array(z.string().trim().min(1).max(64)).default([]),
});

async function ensureProductExists(env: Env, id: number): Promise<void> {
  const product = await env.FNLSTG_DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first<{ id: number }>();
  if (!product) {
    throw new HttpError(404, 'NOT_FOUND', 'Product not found');
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const id = idSchema.parse(context.params.id);
  await ensureProductExists(context.env, id);
  const { results } = await context.env.FNLSTG_DB.prepare(
    'SELECT tag FROM product_tags WHERE product_id = ? ORDER BY tag COLLATE NOCASE ASC',
  ).bind(id).all<{ tag: string }>();
  return ok({ tags: (results ?? []).map((row: { tag: string }) => row.tag) });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const id = idSchema.parse(context.params.id);
  await ensureProductExists(context.env, id);
  const payload = await parseJson(context.request, updateSchema);
  const tags = normalizeProductTags(payload.tags);
  const statements = [
    context.env.FNLSTG_DB.prepare('DELETE FROM product_tags WHERE product_id = ?').bind(id),
    ...tags.map((tag) =>
      context.env.FNLSTG_DB.prepare('INSERT OR IGNORE INTO product_tags (product_id, tag) VALUES (?, ?)').bind(id, tag),
    ),
  ];
  await context.env.FNLSTG_DB.batch(statements);
  return ok({ tags });
};
