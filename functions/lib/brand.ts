import {
  brandAdminSchema,
  brandContactInputSchema,
  brandContactSchema,
  brandIdentityInputSchema,
  brandIdentitySchema,
  brandLegalInputSchema,
  brandLegalSchema,
  brandPublicSchema,
  brandSocialInputSchema,
  brandSocialSchema,
  type BrandAdmin,
  type BrandContact,
  type BrandContactInput,
  type BrandIdentity,
  type BrandIdentityInput,
  type BrandLegal,
  type BrandLegalInput,
  type BrandPublic,
  type BrandSocial,
  type BrandSocialInput,
} from '../../shared/schemas/brand';
import type { Env } from './types';

export const BRAND_IDENTITY_KV_KEY = 'brand_identity';
export const BRAND_CONTACT_KV_KEY = 'brand_contact';
export const BRAND_SOCIAL_KV_KEY = 'brand_social';
export const BRAND_LEGAL_KV_KEY = 'brand_legal';
export const BRAND_PUBLIC_CACHE_KEY = 'brand_public_cache';

const socialUrlPrefixByField: Record<keyof BrandSocialInput, string> = {
  instagram: 'https://www.instagram.com/',
  tiktok: 'https://www.tiktok.com/@',
  youtube: 'https://www.youtube.com/@',
  vimeo: 'https://vimeo.com/',
  x_twitter: 'https://x.com/',
  linkedin: 'https://www.linkedin.com/in/',
  facebook: 'https://www.facebook.com/',
  threads: 'https://www.threads.net/@',
  spotify: 'https://open.spotify.com/',
  pinterest: 'https://www.pinterest.com/',
  behance: 'https://www.behance.net/',
};

function nowIso(): string {
  return new Date().toISOString();
}

function parseOrDefault<T>(raw: unknown, schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }, fallback: T): T {
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : fallback;
}

export async function readBrandIdentity(env: Env): Promise<BrandIdentity> {
  const raw = await env.FNLSTG_CONFIG.get(BRAND_IDENTITY_KV_KEY, 'json');
  return parseOrDefault(raw, brandIdentitySchema, brandIdentitySchema.parse({}));
}

export async function readBrandContact(env: Env): Promise<BrandContact> {
  const raw = await env.FNLSTG_CONFIG.get(BRAND_CONTACT_KV_KEY, 'json');
  return parseOrDefault(raw, brandContactSchema, brandContactSchema.parse({}));
}

export async function readBrandSocial(env: Env): Promise<BrandSocial> {
  const raw = await env.FNLSTG_CONFIG.get(BRAND_SOCIAL_KV_KEY, 'json');
  return parseOrDefault(raw, brandSocialSchema, brandSocialSchema.parse({}));
}

export async function readBrandLegal(env: Env): Promise<BrandLegal> {
  const raw = await env.FNLSTG_CONFIG.get(BRAND_LEGAL_KV_KEY, 'json');
  return parseOrDefault(raw, brandLegalSchema, brandLegalSchema.parse({}));
}

export async function readBrandAdmin(env: Env): Promise<BrandAdmin> {
  const [identity, contact, social, legal] = await Promise.all([
    readBrandIdentity(env),
    readBrandContact(env),
    readBrandSocial(env),
    readBrandLegal(env),
  ]);
  return brandAdminSchema.parse({ identity, contact, social, legal });
}

export function toBrandPublic(brand: BrandAdmin): BrandPublic {
  return brandPublicSchema.parse(brand);
}

export async function bustBrandPublicCache(env: Env): Promise<void> {
  await env.FNLSTG_CONFIG.delete(BRAND_PUBLIC_CACHE_KEY);
}

export async function upsertBrandIdentity(env: Env, payload: BrandIdentityInput): Promise<BrandIdentity> {
  const next = brandIdentitySchema.parse({ ...brandIdentityInputSchema.parse(payload), updated_at: nowIso() });
  await env.FNLSTG_CONFIG.put(BRAND_IDENTITY_KV_KEY, JSON.stringify(next));
  await bustBrandPublicCache(env);
  return next;
}

export function toE164(phone: string): string {
  const raw = phone.trim();
  if (!raw) return '';

  if (raw.startsWith('+')) {
    const digits = raw.replace(/\D/g, '');
    return digits ? `+${digits}` : '';
  }

  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return '';
}

export async function upsertBrandContact(env: Env, payload: BrandContactInput): Promise<BrandContact> {
  const parsed = brandContactInputSchema.parse(payload);
  const next = brandContactSchema.parse({
    ...parsed,
    phone_e164: toE164(parsed.phone),
    updated_at: nowIso(),
  });
  await env.FNLSTG_CONFIG.put(BRAND_CONTACT_KV_KEY, JSON.stringify(next));
  await bustBrandPublicCache(env);
  return next;
}

function normalizeSocialUrl(field: keyof BrandSocialInput, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const cleaned = trimmed.replace(/^@+/, '').replace(/^\//, '');
  if (!cleaned) return '';

  const prefix = socialUrlPrefixByField[field];
  if (field === 'tiktok' || field === 'threads' || field === 'youtube') {
    return `${prefix}${cleaned.replace(/^@+/, '')}`;
  }
  return `${prefix}${cleaned}`;
}

export function normalizeBrandSocial(payload: BrandSocialInput): BrandSocialInput {
  const next = { ...payload };
  (Object.keys(next) as Array<keyof BrandSocialInput>).forEach((field) => {
    next[field] = normalizeSocialUrl(field, next[field]);
  });
  return brandSocialInputSchema.parse(next);
}

export async function upsertBrandSocial(env: Env, payload: BrandSocialInput): Promise<BrandSocial> {
  const normalized = normalizeBrandSocial(brandSocialInputSchema.parse(payload));
  const next = brandSocialSchema.parse({ ...normalized, updated_at: nowIso() });
  await env.FNLSTG_CONFIG.put(BRAND_SOCIAL_KV_KEY, JSON.stringify(next));
  await bustBrandPublicCache(env);
  return next;
}

export async function upsertBrandLegal(env: Env, payload: BrandLegalInput): Promise<BrandLegal> {
  const next = brandLegalSchema.parse(brandLegalInputSchema.parse(payload));
  await env.FNLSTG_CONFIG.put(BRAND_LEGAL_KV_KEY, JSON.stringify(next));
  await bustBrandPublicCache(env);
  return next;
}
