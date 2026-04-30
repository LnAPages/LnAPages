import type { Env } from './types';

export const SHOP_FEATURE_KEY = 'features.shop';

export async function isShopEnabled(env: Env): Promise<boolean> {
  const value = await env.LNAPAGES_CONFIG.get(SHOP_FEATURE_KEY);
  if (value == null) {
    await env.LNAPAGES_CONFIG.put(SHOP_FEATURE_KEY, 'false');
    return false;
  }
  return value === 'true';
}
