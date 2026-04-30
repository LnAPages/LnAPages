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

// GET /api/gallery/tags - list all tags (public, used by the filter UI).
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
    try {
          const { results } = await env.LNAPAGES_DB.prepare(
                  `SELECT tag, COUNT(*) AS count
                     FROM gallery_item_tags
                    GROUP BY tag
                    ORDER BY count DESC, tag ASC`,
                ).all();
          return ok(results);
    } catch (err) {
          const message = err instanceof Error ? err.message : '';
          if (/no such table/i.test(message)) {
                  console.warn('gallery_item_tags table missing; returning empty tag stats');
                  return ok([]);
          }
          return fail(500, 'LIST_TAGS_FAILED', message || 'failed to list tags');
    }
};

// POST /api/gallery/tags - create a tag (admin only).
// Body: { name: string, slug?: string }
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
          await requireAdmin(context);
          const { request, env } = context;

      let body: unknown;
          try {
                  body = await request.json();
          } catch {
                  return fail(400, 'BAD_JSON', 'Invalid JSON body');
          }
          const payload = (body ?? {}) as { name?: unknown; slug?: unknown };

      const name = typeof payload.name === 'string' ? payload.name.trim() : '';
          if (name.length === 0) {
                  return fail(400, 'MISSING_NAME', 'name is required');
          }
          if (name.length > 64) {
                  return fail(400, 'NAME_TOO_LONG', 'name must be 64 characters or fewer');
          }

      const rawSlug = typeof payload.slug === 'string' ? payload.slug.trim() : '';
          const slug = slugify(rawSlug || name);

      try {
              const result = await env.LNAPAGES_DB.prepare(
                        `INSERT INTO tags (name, slug, created_at)
                                 VALUES (?, ?, datetime('now'))`,
                      )
                .bind(name, slug)
                .run();
              const id = Number(result.meta.last_row_id ?? 0);
              return ok({ id, name, slug }, 201);
      } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              if (/UNIQUE/i.test(msg)) {
                        return fail(409, 'TAG_EXISTS', 'A tag with that name or slug already exists');
              }
              throw err;
      }
    } catch (err) {
          if (err instanceof HttpError) return fail(err.status, err.code, err.message);
          const message = err instanceof Error ? err.message : 'failed to create tag';
          return fail(500, 'CREATE_TAG_FAILED', message);
    }
};
