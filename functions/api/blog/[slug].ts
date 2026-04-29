import { blogStateSchema } from '../../../shared/schemas/blog';
import { ok, fail } from '../../lib/http';
import type { Env } from '../../lib/types';

const KV_KEY = 'blog-posts';

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
    const slug = String(params.slug || '');
    if (!slug) return fail(404, 'not_found', 'Post not found');
    const raw = await env.FNLSTG_CONFIG.get(KV_KEY, 'json');
    const parsed = blogStateSchema.safeParse(raw);
    if (!parsed.success) return fail(404, 'not_found', 'Post not found');
    const post = parsed.data.posts.find((p) => p.published && p.slug === slug);
    if (!post) return fail(404, 'not_found', 'Post not found');
    return ok({ post });
};
