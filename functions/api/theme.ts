import { ok } from '../lib/http';
import type { Env } from '../lib/types';

const THEME_KEY = 'theme';
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

const FONT_CHOICES = ['playfair-display', 'fraunces', 'cormorant-garamond', 'inter', 'plus-jakarta-sans', 'dm-sans', 'jetbrains-mono', 'space-grotesk', 'fredoka', 'nunito', 'caveat', 'quicksand', 'bungee', 'vt323', 'press-start-2p', 'space-mono'] as const;
const BASE_SIZE_OPTIONS = ['sm', 'md', 'lg'] as const;
const SCALE_OPTIONS = ['tight', 'balanced', 'dramatic'] as const;
const DENSITY_OPTIONS = ['compact', 'default', 'spacious'] as const;
const MOTION_OPTIONS = ['on', 'reduced'] as const;
const CARD_VARIANTS = ['outline', 'glass', 'solid'] as const;
const BUTTON_STYLE_OPTIONS = ['solid', 'ghost', 'outline', 'pill', 'brutalist', 'glass'] as const;
const SECTION_VARIANTS = ['offset-grid', 'masonry-showcase', 'press-band', 'quote-spotlight', 'cta-stage'] as const;

type ThemeResult = {
  version: 2;
  accent: string;
  accentHover: string;
  accentForeground: string;
  background: string;
  foreground: string;
  surface: string;
  surface2: string;
  surface3: string;
  border: string;
  mutedForeground: string;
  ring: string;
  overlay: string;
  fontDisplay: (typeof FONT_CHOICES)[number];
  fontSerif: (typeof FONT_CHOICES)[number];
  fontSans: (typeof FONT_CHOICES)[number];
  fontMono: (typeof FONT_CHOICES)[number];
  baseSize: (typeof BASE_SIZE_OPTIONS)[number];
  typeScale: (typeof SCALE_OPTIONS)[number];
  density: (typeof DENSITY_OPTIONS)[number];
  radius: number;
  maxContentWidth: number;
  motion: (typeof MOTION_OPTIONS)[number];
  fxScanlines: number;
  fxNoise: number;
  fxVignette: number;
  fxGlow: number;
  fxRail: number;
  fxProgress: number;
  cardVariant: (typeof CARD_VARIANTS)[number];
  cardElevation: number;
  cardHoverLift: number;
  cardCornerAccent: boolean;
  cardTilt: boolean;
  buttonStyle: (typeof BUTTON_STYLE_OPTIONS)[number];
  sectionOrder: Array<(typeof SECTION_VARIANTS)[number]>;
};

const defaults: ThemeResult = {
  version: 2,
  accent: '#C9A962',
  accentHover: '#B89856',
  accentForeground: '#0A0A0A',
  background: '#0A0A0A',
  foreground: '#F5F5F5',
  surface: '#111111',
  surface2: '#1A1A1A',
  surface3: '#232323',
  border: '#2A2A2A',
  mutedForeground: '#A3A3A3',
  ring: '#C9A962',
  overlay: '#000000',
  fontDisplay: 'playfair-display' as const,
  fontSerif: 'cormorant-garamond' as const,
  fontSans: 'inter' as const,
  fontMono: 'jetbrains-mono' as const,
  baseSize: 'md' as const,
  typeScale: 'balanced' as const,
  density: 'default' as const,
  radius: 4,
  maxContentWidth: 1120,
  motion: 'on' as const,
  fxScanlines: 22,
  fxNoise: 18,
  fxVignette: 28,
  fxGlow: 34,
  fxRail: 70,
  fxProgress: 85,
  cardVariant: 'outline' as const,
  cardElevation: 28,
  cardHoverLift: 6,
  cardCornerAccent: true,
  cardTilt: false,
  buttonStyle: 'solid' as const,
  sectionOrder: [...SECTION_VARIANTS],
};

function normalize(value: string): string {
  return HEX_COLOR_RE.test(value) ? value.toUpperCase() : value;
}

function pickHex(candidate: unknown, fallback: string): string {
  return typeof candidate === 'string' && HEX_COLOR_RE.test(candidate)
    ? normalize(candidate)
    : fallback;
}

function pickEnum<T extends readonly string[]>(candidate: unknown, options: T, fallback: T[number]): T[number] {
  return typeof candidate === 'string' && options.includes(candidate as T[number]) ? (candidate as T[number]) : fallback;
}

function pickNumber(candidate: unknown, fallback: number, min: number, max: number): number {
  const value = typeof candidate === 'number' ? candidate : Number(candidate);
  if (Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function pickBoolean(candidate: unknown, fallback: boolean): boolean {
  return typeof candidate === 'boolean' ? candidate : fallback;
}

function pickSectionOrder(candidate: unknown): ThemeResult['sectionOrder'] {
  if (!Array.isArray(candidate)) return [...defaults.sectionOrder];
  const incoming = candidate.filter(
    (entry): entry is ThemeResult['sectionOrder'][number] => typeof entry === 'string' && SECTION_VARIANTS.includes(entry as ThemeResult['sectionOrder'][number]),
  );
  const deduped = Array.from(new Set(incoming));
  for (const variant of SECTION_VARIANTS) {
    if (!deduped.includes(variant)) deduped.push(variant);
  }
  return deduped;
}

function coerceTheme(input: unknown): ThemeResult {
  if (!input || typeof input !== 'object') return { ...defaults };
  const c = input as Record<string, unknown>;
  return {
    version: 2,
    accent: pickHex(c.accent, defaults.accent),
    accentHover: pickHex(c.accentHover, defaults.accentHover),
    accentForeground: pickHex(c.accentForeground, defaults.accentForeground),
    background: pickHex(c.background, defaults.background),
    foreground: pickHex(c.foreground, defaults.foreground),
    surface: pickHex(c.surface, defaults.surface),
    surface2: pickHex(c.surface2, defaults.surface2),
    surface3: pickHex(c.surface3, defaults.surface3),
    border: pickHex(c.border, defaults.border),
    mutedForeground: pickHex(c.mutedForeground, defaults.mutedForeground),
    ring: pickHex(c.ring, defaults.ring),
    overlay: pickHex(c.overlay, defaults.overlay),
    fontDisplay: pickEnum(c.fontDisplay, FONT_CHOICES, defaults.fontDisplay),
    fontSerif: pickEnum(c.fontSerif, FONT_CHOICES, defaults.fontSerif),
    fontSans: pickEnum(c.fontSans, FONT_CHOICES, defaults.fontSans),
    fontMono: pickEnum(c.fontMono, FONT_CHOICES, defaults.fontMono),
    baseSize: pickEnum(c.baseSize, BASE_SIZE_OPTIONS, defaults.baseSize),
    typeScale: pickEnum(c.typeScale, SCALE_OPTIONS, defaults.typeScale),
    density: pickEnum(c.density, DENSITY_OPTIONS, defaults.density),
    radius: pickNumber(c.radius, defaults.radius, 0, 24),
    maxContentWidth: pickNumber(c.maxContentWidth, defaults.maxContentWidth, 920, 1600),
    motion: pickEnum(c.motion, MOTION_OPTIONS, defaults.motion),
    fxScanlines: pickNumber(c.fxScanlines, defaults.fxScanlines, 0, 100),
    fxNoise: pickNumber(c.fxNoise, defaults.fxNoise, 0, 100),
    fxVignette: pickNumber(c.fxVignette, defaults.fxVignette, 0, 100),
    fxGlow: pickNumber(c.fxGlow, defaults.fxGlow, 0, 100),
    fxRail: pickNumber(c.fxRail, defaults.fxRail, 0, 100),
    fxProgress: pickNumber(c.fxProgress, defaults.fxProgress, 0, 100),
    cardVariant: pickEnum(c.cardVariant, CARD_VARIANTS, defaults.cardVariant),
    cardElevation: pickNumber(c.cardElevation, defaults.cardElevation, 0, 100),
    cardHoverLift: pickNumber(c.cardHoverLift, defaults.cardHoverLift, 0, 24),
    cardCornerAccent: pickBoolean(c.cardCornerAccent, defaults.cardCornerAccent),
    cardTilt: pickBoolean(c.cardTilt, defaults.cardTilt),
    buttonStyle: pickEnum(c.buttonStyle, BUTTON_STYLE_OPTIONS, defaults.buttonStyle),
    sectionOrder: pickSectionOrder(c.sectionOrder),
  };
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const raw = await env.LNAPAGES_CONFIG.get(THEME_KEY, 'json');
  const payload = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const version = payload.version;
  if (version === 2) return ok(coerceTheme(payload));
  return ok(coerceTheme({ ...defaults, ...payload, version: 2 }));
};
