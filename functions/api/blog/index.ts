import { blogStateSchema } from '../../../shared/schemas/blog';
import { ok } from '../../lib/http';
import type { Env } from '../../lib/types';

const KV_KEY = 'blog-posts';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const raw = await env.LNAPAGES_CONFIG.get(KV_KEY, 'json');
  const parsed = blogStateSchema.safeParse(raw);
  const posts = parsed.success ? parsed.data.posts : [];
  const published = posts
    .filter((p) => p.published)
    .sort((a, b) => {
      const ad = a.published_at ?? a.created_at;
      const bd = b.published_at ?? b.created_at;
      return bd.localeCompare(ad);
    });
  return ok({ posts: published });
};
