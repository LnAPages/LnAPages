export const CANONICAL_CATEGORY_SLUGS = [
  'web-design',
  'photography',
  'videography',
  'content-promotion',
  'artist-packages',
] as const;

export type CanonicalCategorySlug = (typeof CANONICAL_CATEGORY_SLUGS)[number];

/** Default talent slugs for service tagging (med-spa). These match the talent_slug values in service_talents. */
export const DEFAULT_TALENT_SLUGS = [
  'injectables',
  'laser-light',
  'facials',
  'skin-treatments',
  'wellness',
] as const;

export type DefaultTalentSlug = (typeof DEFAULT_TALENT_SLUGS)[number];

export const WEDDING_SERVICE_SLUGS = [
  'wedding-3hr',
  'wedding-6hr',
  'wedding-8hr',
] as const;
