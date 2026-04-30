import { ok } from '../lib/http';
import {
  BRAND_PUBLIC_CACHE_KEY,
  readBrandAdmin,
  toBrandPublic,
} from '../lib/brand';
import { brandPublicSchema } from '../../shared/schemas/brand';
import type { Env } from '../lib/types';

const BRAND_PUBLIC_CACHE_TTL_SECONDS = 60;

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const cached = await env.LNAPAGES_CONFIG.get(BRAND_PUBLIC_CACHE_KEY, 'json');
  const parsedCache = brandPublicSchema.safeParse(cached);
  if (parsedCache.success) {
    return ok(parsedCache.data);
  }

  const full = await readBrandAdmin(env);
  const payload = toBrandPublic(full);
  await env.LNAPAGES_CONFIG.put(BRAND_PUBLIC_CACHE_KEY, JSON.stringify(payload), {
    expirationTtl: BRAND_PUBLIC_CACHE_TTL_SECONDS,
  });

  return ok(payload);
};
