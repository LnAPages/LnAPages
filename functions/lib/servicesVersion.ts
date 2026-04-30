import type { Env } from './types';

const SERVICES_INDEX_VERSION_KEY = 'services-index-version';

export const noStoreHeaders: HeadersInit = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function getServicesVersion(env: Env): Promise<string> {
  const kvVersion = await env.LNAPAGES_CONFIG.get(SERVICES_INDEX_VERSION_KEY);
  if (kvVersion) return kvVersion;
  return '0';
}

export async function touchServicesVersion(env: Env): Promise<string> {
  const version = `${Date.now()}-${crypto.randomUUID()}`;
  await env.LNAPAGES_CONFIG.put(SERVICES_INDEX_VERSION_KEY, version);
  return version;
}
