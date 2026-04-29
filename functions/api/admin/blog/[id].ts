import { blogStateSchema, blogPostInputSchema, type BlogPost } from '../../../../shared/schemas/blog';
import { ok, fail, parseJson, requireAdmin } from '../../../lib/http';
import type { Env } from '../../../lib/types';

const KV_KEY = 'blog-posts';

async function loadPosts(env: Env): Promise<BlogPost[]> {
    const raw = await env.FNLSTG_CONFIG.get(KV_KEY, 'json');
    const parsed = blogStateSchema.safeParse(raw);
    return parsed.success ? parsed.data.posts : [];
}

async function savePosts(env: Env, posts: BlogPost[]): Promise<void> {
    await env.FNLSTG_CONFIG.put(KV_KEY, JSON.stringify({ posts }));
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
    await requireAdmin(context);
    const id = String(context.params.id || '');
    if (!id) return fail(404, 'not_found', 'Post not found');
    const payload = await parseJson(context.request, blogPostInputSchema);
    const posts = await loadPosts(context.env);
    const idx = posts.findIndex((p) => p.id === id);
    if (idx === -1) return fail(404, 'not_found', 'Post not found');
    if (posts.some((p) => p.slug === payload.slug && p.id !== id)) {
          return fail(400, 'slug_taken', 'Another post already uses that slug.');
    }
    const prev = posts[idx];
    const now = new Date().toISOString();
    const willPublish = payload.published ?? false;
    const updated: BlogPost = {
          ...prev,
          slug: payload.slug,
          title: payload.title,
          excerpt: payload.excerpt ?? '',
          body: payload.body ?? '',
          cover_url: payload.cover_url ?? '',
          author: payload.author ?? '',
          published: willPublish,
          published_at: willPublish
            ? (payload.published_at ?? prev.published_at ?? now)
                  : null,
          updated_at: now,
    };
    posts[idx] = updated;
    await savePosts(context.env, posts);
    return ok({ post: updated });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
    await requireAdmin(context);
    const id = String(context.params.id || '');
    const posts = await loadPosts(context.env);
    const next = posts.filter((p) => p.id !== id);
    if (next.length === posts.length) return fail(404, 'not_found', 'Post not found');
    await savePosts(context.env, next);
    return ok({ deleted: id });
};
