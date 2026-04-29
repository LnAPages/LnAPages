import { z } from 'zod';

const stringField = z.string().trim().max(500).default('');
const brandListField = z.array(z.string().trim().max(200)).max(24).default([]);
const brandTestimonialSchema = z.object({
  quote: z.string().trim().max(2_000).default(''),
  attribution: z.string().trim().max(500).default(''),
});

const heroMediaModeSchema = z.enum(['off', 'photo', 'video', 'photo+video']).default('off');

export const brandIdentityInputSchema = z.object({
  business_name: stringField,
  short_name: stringField,
  tagline: z.string().trim().max(500).default(''),
  hero_paragraph: z.string().trim().max(4_000).default(''),
  footer_blurb: z.string().trim().max(4_000).default(''),
  closing_cta: z.string().trim().max(500).default(''),
  credits_marquee: brandListField,
  press_logos: brandListField,
  testimonials: z.array(brandTestimonialSchema).max(12).default([]),
  hero_media_mode: heroMediaModeSchema,
  hero_media_count: z.number().int().min(3).max(12).default(7),
  hero_media_video_url: z.string().trim().max(1_500).default(''),
  hero_media_poster_url: z.string().trim().max(1_500).default(''),
  mission: z.string().trim().max(4000).default(''),
  founded_year: z.number().int().min(0).max(3000).nullable().default(null),
  logo_url: z.string().trim().max(1_500).default(''),
  wordmark_url: z.string().trim().max(1_500).default(''),
  favicon_url: z.string().trim().max(1_500).default(''),
  og_image_url: z.string().trim().max(1_500).default(''),
  brand_voice: z.string().trim().max(4_000).default(''),
});

export const brandIdentitySchema = brandIdentityInputSchema.extend({
  updated_at: z.string().default(''),
});

export const brandHoursEntrySchema = z.object({
  day: z.string().trim().max(32),
  open: z.string().trim().max(32).default(''),
  close: z.string().trim().max(32).default(''),
  closed: z.boolean().default(false),
});

export const brandContactInputSchema = z.object({
  email: z.string().trim().max(320).default(''),
  booking_email: z.string().trim().max(320).default(''),
  phone: z.string().trim().max(64).default(''),
  sms_ok: z.boolean().default(false),
  address: z.object({
    street: z.string().trim().max(200).default(''),
    city: z.string().trim().max(120).default(''),
    region: z.string().trim().max(120).default(''),
    postal_code: z.string().trim().max(40).default(''),
    country: z.string().trim().max(120).default(''),
  }).default({
    street: '',
    city: '',
    region: '',
    postal_code: '',
    country: '',
  }),
  service_area: z.string().trim().max(1_000).default(''),
  hours: z.array(brandHoursEntrySchema).max(14).default([]),
  timezone: z.string().trim().max(120).default(''),
});

export const brandContactSchema = brandContactInputSchema.extend({
  phone_e164: z.string().trim().max(32).default(''),
  updated_at: z.string().default(''),
});

const socialField = z.string().trim().max(1_500).default('');

export const brandSocialInputSchema = z.object({
  instagram: socialField,
  tiktok: socialField,
  youtube: socialField,
  vimeo: socialField,
  x_twitter: socialField,
  linkedin: socialField,
  facebook: socialField,
  threads: socialField,
  spotify: socialField,
  pinterest: socialField,
  behance: socialField,
});

export const brandSocialSchema = brandSocialInputSchema.extend({
  updated_at: z.string().default(''),
});

export const brandLegalInputSchema = z.object({
  legal_name: z.string().trim().max(500).default(''),
  ein: z.string().trim().max(64).default(''),
  terms_url: z.string().trim().max(1_500).default(''),
  privacy_url: z.string().trim().max(1_500).default(''),
  copyright_notice: z.string().trim().max(500).default(''),
});

export const brandLegalSchema = brandLegalInputSchema;

export const brandAdminSchema = z.object({
  identity: brandIdentitySchema,
  contact: brandContactSchema,
  social: brandSocialSchema,
  legal: brandLegalSchema,
});

export const brandPublicSchema = z.object({
  identity: brandIdentitySchema.pick({
    business_name: true,
    short_name: true,
    tagline: true,
    hero_paragraph: true,
    footer_blurb: true,
    closing_cta: true,
    credits_marquee: true,
    press_logos: true,
    testimonials: true,
    hero_media_mode: true,
    hero_media_count: true,
    hero_media_video_url: true,
    hero_media_poster_url: true,
    mission: true,
    founded_year: true,
    logo_url: true,
    wordmark_url: true,
    favicon_url: true,
    og_image_url: true,
    brand_voice: true,
    updated_at: true,
  }),
  contact: brandContactSchema.pick({
    email: true,
    phone: true,
    sms_ok: true,
    address: true,
    service_area: true,
    hours: true,
    timezone: true,
    updated_at: true,
  }),
  social: brandSocialSchema,
  legal: brandLegalSchema.pick({
    terms_url: true,
    privacy_url: true,
    copyright_notice: true,
  }),
});

export type BrandIdentity = z.infer<typeof brandIdentitySchema>;
export type BrandIdentityInput = z.infer<typeof brandIdentityInputSchema>;
export type BrandContact = z.infer<typeof brandContactSchema>;
export type BrandContactInput = z.infer<typeof brandContactInputSchema>;
export type BrandSocial = z.infer<typeof brandSocialSchema>;
export type BrandSocialInput = z.infer<typeof brandSocialInputSchema>;
export type BrandLegal = z.infer<typeof brandLegalSchema>;
export type BrandLegalInput = z.infer<typeof brandLegalInputSchema>;
export type BrandAdmin = z.infer<typeof brandAdminSchema>;
export type BrandPublic = z.infer<typeof brandPublicSchema>;
