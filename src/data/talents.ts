export type Talent = {
  slug: 'injectables' | 'laser-light' | 'facials' | 'skin-treatments' | 'wellness';
  label: string;
  blurb: string;
  icon: string; // lucide icon name (as string, used with dynamic import or just stored)
  accentTintHsl: string; // e.g. "39 51% 59%"
};

export const TALENTS: Talent[] = [
  {
    slug: 'injectables',
    label: 'Injectables',
    blurb: 'Botox, Dysport, and dermal fillers for natural-looking rejuvenation.',
    icon: 'Syringe',
    accentTintHsl: '340 65% 60%',
  },
  {
    slug: 'laser-light',
    label: 'Laser & Light',
    blurb: 'IPL and laser treatments for skin clarity, tone, and permanent hair reduction.',
    icon: 'Zap',
    accentTintHsl: '220 70% 60%',
  },
  {
    slug: 'facials',
    label: 'Facials',
    blurb: 'HydraFacials and chemical peels for deep cleansing and radiant skin.',
    icon: 'Sparkles',
    accentTintHsl: '39 51% 59%',
  },
  {
    slug: 'skin-treatments',
    label: 'Skin Treatments',
    blurb: 'Microneedling, PRP, and dermaplaning for texture and collagen renewal.',
    icon: 'Star',
    accentTintHsl: '270 60% 62%',
  },
  {
    slug: 'wellness',
    label: 'Wellness',
    blurb: 'IV drips and vitamin injections for energy, immunity, and recovery.',
    icon: 'Heart',
    accentTintHsl: '150 55% 50%',
  },
];

export type TalentSlug = Talent['slug'];

export function getTalentBySlug(slug: string): Talent | undefined {
  return TALENTS.find((t) => t.slug === slug);
}
