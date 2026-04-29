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

function newId(): string {
  return 'post_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const posts = await loadPosts(context.env);
  posts.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return ok({ posts });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const payload = await parseJson(context.request, blogPostInputSchema);
  const posts = await loadPosts(context.env);
  if (posts.some((p) => p.slug === payload.slug)) {
    return fail(400, 'slug_taken', 'A post with that slug already exists.');
  }
  const now = new Date().toISOString();
  const post: BlogPost = {
    id: newId(),
    slug: payload.slug,
    title: payload.title,
    excerpt: payload.excerpt ?? '',
    body: payload.body ?? '',
    cover_url: payload.cover_url ?? '',
    author: payload.author ?? '',
    published: payload.published ?? false,
    published_at: payload.published ? (payload.published_at ?? now) : null,
    created_at: now,
    updated_at: now,
  };
  posts.unshift(post);
  await savePosts(context.env, posts);
  return ok({ post });
};
