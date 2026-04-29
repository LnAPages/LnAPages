import { ok, fail, HttpError, requireAdmin } from '../../../lib/http';
import type { Env } from '../../../lib/types';

function slugify(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'tag';
}

function parseId(raw: unknown): number | null {
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
}

function parseItemId(request: Request): number | null {
    const url = new URL(request.url);
    const raw = url.searchParams.get('itemId');
    if (raw === null) return null;
    return parseId(raw);
}

// PATCH /api/gallery/tags/:id
// Body: { name?: string, slug?: string }
export const onRequestPatch: PagesFunction<Env> = async (context) => {
    try {
          await requireAdmin(context);
          const { request, env, params } = context;

      const id = parseId(params.id);
          if (id === null) return fail(400, 'BAD_ID', 'Invalid tag id');

      let body: unknown;
          try {
                  body = await request.json();
          } catch {
                  return fail(400, 'BAD_JSON', 'Invalid JSON body');
          }
          const payload = (body ?? {}) as { name?: unknown; slug?: unknown };

      const nameInput = typeof payload.name === 'string' ? payload.name.trim() : null;
          const slugInput = typeof payload.slug === 'string' ? payload.slug.trim() : null;
          if (nameInput === null && slugInput === null) {
                  return fail(400, 'NOTHING_TO_UPDATE', 'Provide name and/or slug');
          }
          if (nameInput !== null && (nameInput.length === 0 || nameInput.length > 64)) {
                  return fail(400, 'BAD_NAME', 'name must be 1-64 characters');
          }

      const sets: string[] = [];
          const binds: unknown[] = [];
          if (nameInput !== null) {
                  sets.push('name = ?');
                  binds.push(nameInput);
          }
          if (slugInput !== null) {
                  sets.push('slug = ?');
                  binds.push(slugify(slugInput));
          }
          binds.push(id);

      try {
              const result = await env.FNLSTG_DB.prepare(
                        `UPDATE tags SET ${sets.join(', ')} WHERE id = ?`,
                      )
                .bind(...binds)
                .run();
              const changes = Number(result.meta.changes ?? 0);
              if (changes === 0) return fail(404, 'NOT_FOUND', 'Tag not found');
      } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              if (/UNIQUE/i.test(msg)) {
                        return fail(409, 'TAG_EXISTS', 'Another tag already uses that name or slug');
              }
              throw err;
      }

      const row = await env.FNLSTG_DB.prepare(
              'SELECT id, name, slug, created_at FROM tags WHERE id = ?',
            )
            .bind(id)
            .first();
          return ok({ tag: row });
    } catch (err) {
          if (err instanceof HttpError) return fail(err.status, err.code, err.message);
          const message = err instanceof Error ? err.message : 'failed to update tag';
          return fail(500, 'UPDATE_TAG_FAILED', message);
    }
};

// PUT /api/gallery/tags/:id?itemId=N
// Attaches tag :id to gallery item :itemId. Idempotent.
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
          await requireAdmin(context);
          const { request, env, params } = context;

      const tagId = parseId(params.id);
          if (tagId === null) return fail(400, 'BAD_ID', 'Invalid tag id');
          const itemId = parseItemId(request);
          if (itemId === null) {
                  return fail(400, 'MISSING_ITEM_ID', 'Query param itemId is required to attach');
          }

      // Verify both rows exist to produce a clean 404 rather than an FK error.
      const tag = await env.FNLSTG_DB.prepare('SELECT id FROM tags WHERE id = ?')
            .bind(tagId)
            .first();
          if (!tag) return fail(404, 'TAG_NOT_FOUND', 'Tag not found');
          const item = await env.FNLSTG_DB.prepare('SELECT id FROM gallery_items WHERE id = ?')
            .bind(itemId)
            .first();
          if (!item) return fail(404, 'ITEM_NOT_FOUND', 'Gallery item not found');

      await env.FNLSTG_DB.prepare(
              `INSERT OR IGNORE INTO gallery_tags (gallery_item_id, tag_id) VALUES (?, ?)`,
            )
            .bind(itemId, tagId)
            .run();

      return ok({ attached: true, itemId, tagId });
    } catch (err) {
          if (err instanceof HttpError) return fail(err.status, err.code, err.message);
          const message = err instanceof Error ? err.message : 'failed to attach tag';
          return fail(500, 'ATTACH_TAG_FAILED', message);
    }
};

// DELETE /api/gallery/tags/:id
//   - no itemId  -> delete the tag entirely (cascades rows in gallery_tags)
//   - itemId=N   -> detach tag :id from gallery item N only
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
          await requireAdmin(context);
          const { request, env, params } = context;

      const tagId = parseId(params.id);
          if (tagId === null) return fail(400, 'BAD_ID', 'Invalid tag id');
          const itemId = parseItemId(request);

      if (itemId !== null) {
              const result = await env.FNLSTG_DB.prepare(
                        `DELETE FROM gallery_tags WHERE tag_id = ? AND gallery_item_id = ?`,
                      )
                .bind(tagId, itemId)
                .run();
              const changes = Number(result.meta.changes ?? 0);
              return ok({ detached: changes > 0, itemId, tagId });
      }

      const result = await env.FNLSTG_DB.prepare('DELETE FROM tags WHERE id = ?')
            .bind(tagId)
            .run();
          const changes = Number(result.meta.changes ?? 0);
          if (changes === 0) return fail(404, 'NOT_FOUND', 'Tag not found');
          return ok({ deleted: true, tagId });
    } catch (err) {
          if (err instanceof HttpError) return fail(err.status, err.code, err.message);
          const message = err instanceof Error ? err.message : 'failed to delete tag';
          return fail(500, 'DELETE_TAG_FAILED', message);
    }
};
