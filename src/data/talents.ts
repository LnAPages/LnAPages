export type Talent = {
  slug: 'web-design' | 'photography' | 'videography' | 'content-promotion' | 'artist-packages';
  label: string;
  blurb: string;
  icon: string; // lucide icon name (as string, used with dynamic import or just stored)
  accentTintHsl: string; // e.g. "39 51% 59%"
};

export const TALENTS: Talent[] = [
  {
    slug: 'web-design',
    label: 'Web Design',
    blurb: 'Editorial digital presence and campaign landing pages built to convert and impress.',
    icon: 'Monitor',
    accentTintHsl: '220 70% 60%',
  },
  {
    slug: 'photography',
    label: 'Photography',
    blurb: 'Studio and location sessions shaped for album cycles, campaigns, and launch moments.',
    icon: 'Camera',
    accentTintHsl: '39 51% 59%',
  },
  {
    slug: 'videography',
    label: 'Videography',
    blurb: 'Cutdowns, hero edits, and launch trailers with cinema-first pacing and polish.',
    icon: 'Film',
    accentTintHsl: '270 60% 62%',
  },
  {
    slug: 'content-promotion',
    label: 'Content Promotion',
    blurb: 'Distribution strategy and asset packages built for platform-native performance.',
    icon: 'Megaphone',
    accentTintHsl: '150 55% 50%',
  },
  {
    slug: 'artist-packages',
    label: 'Artist Packages',
    blurb: 'Concept, pre-pro, capture, and post wrapped into one cohesive visual identity.',
    icon: 'Music',
    accentTintHsl: '0 60% 60%',
  },
];

export type TalentSlug = Talent['slug'];

export function getTalentBySlug(slug: string): Talent | undefined {
  return TALENTS.find((t) => t.slug === slug);
}

export function classifyService(name: string, slug: string, description: string): TalentSlug {
  const content = `${name} ${slug} ${description}`.toLowerCase();
  if (/(web|site|landing|digital|design|ui|ux)/.test(content)) return 'web-design';
  if (/(photo|portrait|headshot|wedding|engagement|still)/.test(content)) return 'photography';
  if (/(film|video|podcast|reel|cinema|edit|videograph)/.test(content)) return 'videography';
  if (/(promot|distribut|content|social|ads|reach|marketing)/.test(content)) return 'content-promotion';
  if (/(artist|music|album|single|campaign|package|bundle)/.test(content)) return 'artist-packages';
  return 'artist-packages'; // fallback
}
