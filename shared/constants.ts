export const CANONICAL_CATEGORY_SLUGS = [
  'web-design',
  'photography',
  'videography',
  'content-promotion',
  'artist-packages',
] as const;

export type CanonicalCategorySlug = (typeof CANONICAL_CATEGORY_SLUGS)[number];

export const WEDDING_SERVICE_SLUGS = [
  'wedding-3hr',
  'wedding-6hr',
  'wedding-8hr',
] as const;
