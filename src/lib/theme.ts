export const FONT_CHOICES = [
  'playfair-display',
  'fraunces',
  'cormorant-garamond',
  'inter',
  'plus-jakarta-sans',
  'dm-sans',
  'jetbrains-mono',
  'space-grotesk',
  // Cutesy / creative presets
  'fredoka',
  'nunito',
  'caveat',
  'quicksand',
  'bungee',
  'vt323',
  'press-start-2p',
  'space-mono',
] as const;

export const BASE_SIZE_OPTIONS = ['sm', 'md', 'lg'] as const;
export const SCALE_OPTIONS = ['tight', 'balanced', 'dramatic'] as const;
export const DENSITY_OPTIONS = ['compact', 'default', 'spacious'] as const;
export const MOTION_OPTIONS = ['on', 'reduced'] as const;
export const CARD_VARIANTS = ['outline', 'glass', 'solid'] as const;
export const BUTTON_STYLE_OPTIONS = ['solid', 'ghost', 'outline', 'pill', 'brutalist', 'glass'] as const;
export const SECTION_VARIANTS = [
  'offset-grid',
  'masonry-showcase',
  'press-band',
  'quote-spotlight',
  'cta-stage',
] as const;

export type FontChoice = typeof FONT_CHOICES[number];
export type BaseSizeOption = typeof BASE_SIZE_OPTIONS[number];
export type ScaleOption = typeof SCALE_OPTIONS[number];
export type DensityOption = typeof DENSITY_OPTIONS[number];
export type MotionOption = typeof MOTION_OPTIONS[number];
export type CardVariant = typeof CARD_VARIANTS[number];
export type ButtonStyle = typeof BUTTON_STYLE_OPTIONS[number];
export type SectionVariant = typeof SECTION_VARIANTS[number];

export type ThemeConfig = {
  version: 2;
  // Colors (12)
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
  // Typography
  fontDisplay: FontChoice;
  fontSerif: FontChoice;
  fontSans: FontChoice;
  fontMono: FontChoice;
  baseSize: BaseSizeOption;
  typeScale: ScaleOption;
  // Layout
  density: DensityOption;
  radius: number;
  maxContentWidth: number;
  motion: MotionOption;
  // FX
  fxScanlines: number;
  fxNoise: number;
  fxVignette: number;
  fxGlow: number;
  fxRail: number;
  fxProgress: number;
  // Cards
  cardVariant: CardVariant;
  cardElevation: number;
  cardHoverLift: number;
  cardCornerAccent: boolean;
  cardTilt: boolean;
  buttonStyle: ButtonStyle;
  // Sections
  sectionOrder: SectionVariant[];
};

export const FINAL_STAGE_THEME: ThemeConfig = {
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
  fontDisplay: 'playfair-display',
  fontSerif: 'cormorant-garamond',
  fontSans: 'inter',
  fontMono: 'jetbrains-mono',
  baseSize: 'md',
  typeScale: 'balanced',
  density: 'default',
  radius: 4,
  maxContentWidth: 1120,
  motion: 'on',
  fxScanlines: 22,
  fxNoise: 18,
  fxVignette: 28,
  fxGlow: 34,
  fxRail: 70,
  fxProgress: 85,
  cardVariant: 'outline',
  cardElevation: 28,
  cardHoverLift: 6,
  cardCornerAccent: true,
  cardTilt: false,
  buttonStyle: 'solid',
  sectionOrder: [...SECTION_VARIANTS],
};

export type BrandPreset = {
  id: string;
  label: string;
  vibe_description: string;
  theme: ThemeConfig;
};

export const BRAND_PRESETS: BrandPreset[] = [
    // ── Medical / Aesthetic Spa Themes ─────────────────────────────────────────
  {
        id: 'warm-plum',
        label: 'Warm Plum',
        vibe_description: 'cream warmth — plum elegance, rose softness, soft serif headlines',
        theme: {
                ...FINAL_STAGE_THEME,
                accent: '#3A2030',
                accentHover: '#4A2A3F',
                accentForeground: '#FAF7F4',
                ring: '#B07B7B',
                background: '#FAF7F4',
                foreground: '#2A1F1A',
                surface: '#F4EFE9',
                surface2: '#ECE6DD',
                surface3: '#E3DBD0',
                border: '#E0D8CD',
                mutedForeground: '#8A7E72',
                overlay: '#1F111A',
                fontDisplay: 'playfair-display',
                fontSerif: 'playfair-display',
                fontSans: 'plus-jakarta-sans',
                fontMono: 'jetbrains-mono',
                baseSize: 'md',
                typeScale: 'balanced',
                density: 'default',
                radius: 7,
                motion: 'on',
                fxScanlines: 0,
                fxNoise: 4,
                fxVignette: 8,
                fxGlow: 2,
                fxRail: 0,
                fxProgress: 30,
                cardVariant: 'solid',
                cardElevation: 14,
                cardHoverLift: 4,
                cardCornerAccent: true,
                cardTilt: false,
                buttonStyle: 'outline',
                sectionOrder: [...SECTION_VARIANTS],
        },
  },
  {
        id: 'coastal-teal',
        label: 'Coastal Teal',
        vibe_description: 'crisp linen warmth — navy authority, teal vitality, Playfair serif headlines',
        theme: {
                ...FINAL_STAGE_THEME,
                accent: '#1A2B3C',
                accentHover: '#243447',
                accentForeground: '#FFFFFF',
                ring: '#2A7D6F',
                background: '#F8F7F5',
                foreground: '#1A1814',
                surface: '#F2F0ED',
                surface2: '#EAE8E4',
                surface3: '#E3E0DB',
                border: '#DDD9D3',
                mutedForeground: '#7A7268',
                overlay: '#1A2B3C',
                fontDisplay: 'playfair-display',
                fontSerif: 'playfair-display',
                fontSans: 'plus-jakarta-sans',
                fontMono: 'jetbrains-mono',
                baseSize: 'md',
                typeScale: 'balanced',
                density: 'default',
                radius: 6,
                motion: 'on',
                fxScanlines: 0,
                fxNoise: 4,
                fxVignette: 8,
                fxGlow: 2,
                fxRail: 0,
                fxProgress: 30,
                cardVariant: 'solid',
                cardElevation: 14,
                cardHoverLift: 4,
                cardCornerAccent: true,
                cardTilt: false,
                buttonStyle: 'outline',
                sectionOrder: [...SECTION_VARIANTS],
        },
  },
  {
        id: 'lift-align-medspa',
        label: 'Lift & Align Med Spa',
        vibe_description: 'deep plum rose — warm luxury, serif elegance, rose-pink accents',
        theme: {
                ...FINAL_STAGE_THEME,
                accent: '#C2627A',
                accentHover: '#A8475E',
                accentForeground: '#FFFFFF',
                ring: '#C2627A',
                background: '#1A0A12',
                foreground: '#F5EBF0',
                surface: '#2A1020',
                surface2: '#341428',
                surface3: '#3E1830',
                border: '#5C2A3D',
                mutedForeground: '#B08898',
                overlay: '#0D0508',
                fontDisplay: 'playfair-display',
                fontSerif: 'cormorant-garamond',
                fontSans: 'inter',
                baseSize: 'md',
                typeScale: 'balanced',
                density: 'default',
                radius: 6,
                motion: 'on',
                fxScanlines: 8,
                fxNoise: 12,
                fxVignette: 30,
                fxGlow: 18,
                fxRail: 40,
                fxProgress: 70,
                cardVariant: 'glass',
                cardElevation: 20,
                cardHoverLift: 8,
                cardCornerAccent: true,
                cardTilt: false,
                buttonStyle: 'pill',
        },
  },
  {
        id: 'aesthetic-dental-ops',
        label: 'Dental Ops Navy',
        vibe_description: 'deep navy teal — clinical precision, professional trust, teal accents',
        theme: {
                ...FINAL_STAGE_THEME,
                accent: '#2BBFBF',
                accentHover: '#1FA0A0',
                accentForeground: '#FFFFFF',
                ring: '#2BBFBF',
                background: '#060E1A',
                foreground: '#E8F4F8',
                surface: '#0C1E30',
                surface2: '#10263A',
                surface3: '#142E45',
                border: '#1A3A52',
                mutedForeground: '#7AA8C0',
                overlay: '#030810',
                fontDisplay: 'plus-jakarta-sans',
                fontSerif: 'inter',
                fontSans: 'inter',
                baseSize: 'md',
                typeScale: 'tight',
                density: 'compact',
                radius: 4,
                motion: 'on',
                fxScanlines: 6,
                fxNoise: 8,
                fxVignette: 25,
                fxGlow: 22,
                fxRail: 50,
                fxProgress: 80,
                cardVariant: 'solid',
                cardElevation: 16,
                cardHoverLift: 6,
                cardCornerAccent: false,
                cardTilt: false,
                buttonStyle: 'solid',
        },
  },
  {
        id: 'clinical-white',
        label: 'Clinical White',
        vibe_description: 'clean white sapphire — light clinical look, modern, minimalist',
        theme: {
                ...FINAL_STAGE_THEME,
                accent: '#1A6FBF',
                accentHover: '#1258A0',
                accentForeground: '#FFFFFF',
                ring: '#1A6FBF',
                background: '#F8FAFB',
                foreground: '#0F1923',
                surface: '#FFFFFF',
                surface2: '#F0F5F8',
                surface3: '#E4ECF2',
                border: '#D0DCE8',
                mutedForeground: '#6080A0',
                overlay: '#00000030',
                fontDisplay: 'inter',
                fontSerif: 'inter',
                fontSans: 'inter',
                baseSize: 'md',
                typeScale: 'balanced',
                density: 'default',
                radius: 6,
                motion: 'on',
                fxScanlines: 0,
                fxNoise: 0,
                fxVignette: 8,
                fxGlow: 0,
                fxRail: 60,
                fxProgress: 85,
                cardVariant: 'outline',
                cardElevation: 12,
                cardHoverLift: 4,
                cardCornerAccent: false,
                cardTilt: false,
                buttonStyle: 'solid',
        },
  },
  { id: 'final-stage-gold', label: 'Final Stage Gold', vibe_description: 'editorial gold — cinematic, editorial, architectural', theme: FINAL_STAGE_THEME },
  {
    id: 'obsidian-cyan',
    label: 'Obsidian Cyan',
    vibe_description: 'deep tech — cyber precision, glass surfaces, electric focus',
    theme: {
      ...FINAL_STAGE_THEME,
      accent: '#24D6FF',
      accentHover: '#18B5D9',
      ring: '#24D6FF',
      surface2: '#101A22',
      surface3: '#152434',
      border: '#223A4A',
      mutedForeground: '#92ABC0',
      fxGlow: 48,
      cardVariant: 'glass',
      buttonStyle: 'glass',
    },
  },
  {
    id: 'porcelain-ink',
    label: 'Porcelain Ink',
    vibe_description: 'clean editorial — crisp white, ink-black, zero noise',
    theme: {
      ...FINAL_STAGE_THEME,
      accent: '#2A2A2A',
      accentHover: '#151515',
      accentForeground: '#F7F7F7',
      background: '#FAFAFA',
      foreground: '#121212',
      surface: '#FFFFFF',
      surface2: '#F3F3F3',
      surface3: '#ECECEC',
      border: '#D8D8D8',
      mutedForeground: '#606060',
      ring: '#2A2A2A',
      overlay: '#111111',
      cardVariant: 'solid',
      cardCornerAccent: false,
      fxVignette: 8,
      fxNoise: 9,
      fontSans: 'space-grotesk',
      buttonStyle: 'outline',
    },
  },
  {
    id: 'plum-neon',
    label: 'Plum Neon',
    vibe_description: 'dark glamour — deep violet, neon accents, electric energy',
    theme: {
      ...FINAL_STAGE_THEME,
      accent: '#E84ED8',
      accentHover: '#C23FB5',
      ring: '#E84ED8',
      surface: '#140E18',
      surface2: '#1D1326',
      surface3: '#251A33',
      border: '#3A2B48',
      mutedForeground: '#B7A4C2',
      fxScanlines: 34,
      fxGlow: 58,
      cardTilt: true,
      buttonStyle: 'pill',
    },
  },
  {
    id: 'brass-studio',
    label: 'Brass Studio',
    vibe_description: 'warm brutalism — brass tones, thick shadows, confident craft',
    theme: {
      ...FINAL_STAGE_THEME,
      accent: '#C68F2F',
      accentHover: '#A97623',
      ring: '#C68F2F',
      background: '#120F0B',
      surface: '#19140E',
      surface2: '#231B12',
      surface3: '#2E2418',
      border: '#3D2F1F',
      mutedForeground: '#B9A588',
      cardVariant: 'outline',
      cardElevation: 38,
      cardHoverLift: 10,
      fontDisplay: 'cormorant-garamond',
      fontSerif: 'playfair-display',
      buttonStyle: 'brutalist',
    },
  },
  // ── Cinema FX presets ──────────────────────────────────────────────────────
  {
    id: 'cinema-noir',
    label: 'Cinema Noir',
    vibe_description: 'silver screen — high contrast monochrome, film grain, pure cinema',
    theme: {
      ...FINAL_STAGE_THEME,
      accent: '#E8E8E8',
      accentHover: '#C4C4C4',
      accentForeground: '#0A0A0A',
      ring: '#D0D0D0',
      background: '#050505',
      foreground: '#F0F0F0',
      surface: '#0D0D0D',
      surface2: '#141414',
      surface3: '#1C1C1C',
      border: '#222222',
      mutedForeground: '#888888',
      fontDisplay: 'cormorant-garamond',
      fontSerif: 'cormorant-garamond',
      fxNoise: 52,
      fxVignette: 68,
      fxScanlines: 14,
      fxGlow: 8,
      cardVariant: 'solid',
      cardCornerAccent: false,
      buttonStyle: 'outline',
    },
  },
  {
    id: 'vr-glitch-pop',
    label: 'VR Glitch Pop',
    vibe_description: 'digital rave — neon cyan on void black, scanlines, glitch energy',
    theme: {
      ...FINAL_STAGE_THEME,
      accent: '#00FFB2',
      accentHover: '#00CC8E',
      accentForeground: '#000000',
      ring: '#00FFB2',
      background: '#030808',
      foreground: '#E8FFFA',
      surface: '#091414',
      surface2: '#0E1E1E',
      surface3: '#132828',
      border: '#1A3535',
      mutedForeground: '#5AADA0',
      fontDisplay: 'jetbrains-mono',
      fontSans: 'space-grotesk',
      fxScanlines: 40,
      fxGlow: 72,
      fxNoise: 24,
      fxVignette: 18,
      cardVariant: 'glass',
      cardTilt: true,
      buttonStyle: 'glass',
    },
  },
  {
    id: 'holo-future',
    label: 'Holo Future',
    vibe_description: 'iridescent dusk — lavender mist, holographic shimmer, soft futures',
    theme: {
      ...FINAL_STAGE_THEME,
      accent: '#B97DF5',
      accentHover: '#9A5EDD',
      accentForeground: '#0A0A0A',
      ring: '#B97DF5',
      background: '#06040E',
      foreground: '#F2EEFF',
      surface: '#0D0A1A',
      surface2: '#140F26',
      surface3: '#1C1633',
      border: '#2A2048',
      mutedForeground: '#9B8FC0',
      fontDisplay: 'fraunces',
      fontSerif: 'fraunces',
      fxNoise: 32,
      fxGlow: 56,
      fxVignette: 38,
      fxScanlines: 8,
      cardVariant: 'glass',
      cardElevation: 42,
      cardHoverLift: 10,
      buttonStyle: 'pill',
    },
  },
  // ── Cutesy / creative presets ──────────────────────────────────────────────
  {
    id: 'kawaii-soft',
    label: 'Kawaii Soft',
    vibe_description: 'gentle + welcoming — pastel world, pillowy shapes, spring energy',
    theme: {
      ...FINAL_STAGE_THEME,
      accent: '#FF9BB5',
      accentHover: '#FF7AA0',
      accentForeground: '#3D1A26',
      background: '#FFF5F8',
      foreground: '#3D1A26',
      surface: '#FFFFFF',
      surface2: '#FFF0F5',
      surface3: '#FFE4EF',
      border: '#FFCCE0',
      mutedForeground: '#C4708A',
      ring: '#FF9BB5',
      overlay: '#3D1A26',
      fontDisplay: 'fredoka',
      fontSerif: 'nunito',
      fontSans: 'nunito',
      fontMono: 'space-mono',
      radius: 20,
      buttonStyle: 'pill',
      cardVariant: 'solid',
      cardElevation: 20,
      cardHoverLift: 8,
      cardCornerAccent: false,
      cardTilt: false,
      fxNoise: 0,
      fxScanlines: 0,
      fxVignette: 0,
      fxGlow: 12,
    },
  },
  {
    id: 'paper-scrapbook',
    label: 'Paper Scrapbook',
    vibe_description: 'handmade + intimate — craft paper, tape corners, zine spirit',
    theme: {
      ...FINAL_STAGE_THEME,
      accent: '#8B5E3C',
      accentHover: '#7A4F2E',
      accentForeground: '#FAF4EC',
      background: '#FAF4EC',
      foreground: '#2C1810',
      surface: '#F5EDD8',
      surface2: '#EDE0C4',
      surface3: '#E5D4B0',
      border: '#C8B89A',
      mutedForeground: '#7A6248',
      ring: '#8B5E3C',
      overlay: '#2C1810',
      fontDisplay: 'caveat',
      fontSerif: 'fraunces',
      fontSans: 'quicksand',
      fontMono: 'space-mono',
      radius: 8,
      buttonStyle: 'solid',
      cardVariant: 'outline',
      cardElevation: 40,
      cardHoverLift: 4,
      cardCornerAccent: true,
      cardTilt: false,
      fxNoise: 40,
      fxScanlines: 0,
      fxVignette: 12,
      fxGlow: 0,
    },
  },
  {
    id: 'risograph-zine',
    label: 'Risograph Zine',
    vibe_description: 'DIY print shop — two-ink limited palette, halftone, alt confidence',
    theme: {
      ...FINAL_STAGE_THEME,
      accent: '#FF3366',
      accentHover: '#E02255',
      accentForeground: '#FFFBF0',
      background: '#FFFBF0',
      foreground: '#1A0A14',
      surface: '#FFF5E0',
      surface2: '#FAECD0',
      surface3: '#F5E4C0',
      border: '#1A0A14',
      mutedForeground: '#6B4455',
      ring: '#2255FF',
      overlay: '#1A0A14',
      fontDisplay: 'space-grotesk',
      fontSerif: 'space-grotesk',
      fontSans: 'dm-sans',
      fontMono: 'space-mono',
      radius: 2,
      buttonStyle: 'brutalist',
      cardVariant: 'outline',
      cardElevation: 0,
      cardHoverLift: 0,
      cardCornerAccent: false,
      cardTilt: false,
      fxNoise: 22,
      fxScanlines: 0,
      fxVignette: 4,
      fxGlow: 0,
    },
  },
  {
    id: 'retro-arcade',
    label: 'Retro Arcade',
    vibe_description: 'coin-op nostalgia — neon on void black, pixel art, 8-bit confident',
    theme: {
      ...FINAL_STAGE_THEME,
      accent: '#00FFCC',
      accentHover: '#00E6B8',
      accentForeground: '#000000',
      background: '#0A0015',
      foreground: '#E0E0FF',
      surface: '#100020',
      surface2: '#18003A',
      surface3: '#20005A',
      border: '#3300AA',
      mutedForeground: '#9080CC',
      ring: '#FF00FF',
      overlay: '#000000',
      fontDisplay: 'press-start-2p',
      fontSerif: 'space-mono',
      fontSans: 'space-mono',
      fontMono: 'space-mono',
      radius: 0,
      buttonStyle: 'brutalist',
      cardVariant: 'outline',
      cardElevation: 60,
      cardHoverLift: 0,
      cardCornerAccent: false,
      cardTilt: false,
      fxNoise: 8,
      fxScanlines: 60,
      fxVignette: 20,
      fxGlow: 80,
    },
  },
  {
    id: 'dreamcore-y2k',
    label: 'Dreamcore Y2K',
    vibe_description: 'early-2000s web — chrome-pink + lavender, bubble buttons, holographic',
    theme: {
      ...FINAL_STAGE_THEME,
      accent: '#FF69C0',
      accentHover: '#E050A8',
      accentForeground: '#150026',
      background: '#F0E8FF',
      foreground: '#150026',
      surface: '#E8D8FF',
      surface2: '#DCC8FF',
      surface3: '#CFB8FF',
      border: '#B090E8',
      mutedForeground: '#7A60A0',
      ring: '#FF69C0',
      overlay: '#150026',
      fontDisplay: 'bungee',
      fontSerif: 'nunito',
      fontSans: 'nunito',
      fontMono: 'vt323',
      radius: 24,
      buttonStyle: 'pill',
      cardVariant: 'glass',
      cardElevation: 30,
      cardHoverLift: 10,
      cardCornerAccent: false,
      cardTilt: true,
      fxNoise: 4,
      fxScanlines: 0,
      fxVignette: 6,
      fxGlow: 64,
    },
  },
];

export const FONT_LABELS: Record<FontChoice, string> = {
  'playfair-display': 'Playfair Display',
  fraunces: 'Fraunces',
  'cormorant-garamond': 'Cormorant Garamond',
  inter: 'Inter',
  'plus-jakarta-sans': 'Plus Jakarta Sans',
  'dm-sans': 'DM Sans',
  'jetbrains-mono': 'JetBrains Mono',
  'space-grotesk': 'Space Grotesk',
  fredoka: 'Fredoka',
  nunito: 'Nunito',
  caveat: 'Caveat',
  quicksand: 'Quicksand',
  bungee: 'Bungee',
  vt323: 'VT323',
  'press-start-2p': 'Press Start 2P',
  'space-mono': 'Space Mono',
};

export function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeHex(value: string): string {
  const match = value.trim().match(/^#([0-9a-fA-F]{6})$/);
  if (!match) {
    throw new Error('Invalid hex color format. Expected format: #RRGGBB');
  }
  return `#${match[1].toUpperCase()}`;
}

export function hexToHsl(hex: string): string {
  const normalized = normalizeHex(hex);
  const r = parseInt(normalized.slice(1, 3), 16) / 255;
  const g = parseInt(normalized.slice(3, 5), 16) / 255;
  const b = parseInt(normalized.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }

  h = Math.round((h * 60 + 360) % 360);
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return `${h} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 100) / 100;
  const light = clamp(l, 0, 100) / 100;

  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const channelToHex = (channel: number) => Math.round((channel + m) * 255).toString(16).padStart(2, '0');
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`.toUpperCase();
}

function asEnum<T extends readonly string[]>(value: unknown, options: T, fallback: T[number]): T[number] {
  return (typeof value === 'string' && (options as readonly string[]).includes(value)) ? (value as T[number]) : fallback;
}

function asNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return clamp(Math.round(parsed), min, max);
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function sanitizeSectionOrder(value: unknown): SectionVariant[] {
  if (!Array.isArray(value)) return [...FINAL_STAGE_THEME.sectionOrder];
  const incoming = value.filter((v): v is SectionVariant => typeof v === 'string' && (SECTION_VARIANTS as readonly string[]).includes(v));
  const deduped = Array.from(new Set(incoming));
  for (const variant of SECTION_VARIANTS) {
    if (!deduped.includes(variant)) deduped.push(variant);
  }
  return deduped;
}

export function sanitizeTheme(input: unknown): ThemeConfig {
  if (!input || typeof input !== 'object') return { ...FINAL_STAGE_THEME };
  const theme = input as Record<string, unknown>;

  const color = (key: keyof Pick<ThemeConfig,
    'accent' | 'accentHover' | 'accentForeground' | 'background' | 'foreground' | 'surface' |
    'surface2' | 'surface3' | 'border' | 'mutedForeground' | 'ring' | 'overlay'
  >) => {
    const value = theme[key];
    if (typeof value === 'string' && isValidHex(value)) return value.toUpperCase();
    return FINAL_STAGE_THEME[key];
  };

  return {
    version: 2,
    accent: color('accent'),
    accentHover: color('accentHover'),
    accentForeground: color('accentForeground'),
    background: color('background'),
    foreground: color('foreground'),
    surface: color('surface'),
    surface2: color('surface2'),
    surface3: color('surface3'),
    border: color('border'),
    mutedForeground: color('mutedForeground'),
    ring: color('ring'),
    overlay: color('overlay'),
    fontDisplay: asEnum(theme.fontDisplay, FONT_CHOICES, FINAL_STAGE_THEME.fontDisplay),
    fontSerif: asEnum(theme.fontSerif, FONT_CHOICES, FINAL_STAGE_THEME.fontSerif),
    fontSans: asEnum(theme.fontSans, FONT_CHOICES, FINAL_STAGE_THEME.fontSans),
    fontMono: asEnum(theme.fontMono, FONT_CHOICES, FINAL_STAGE_THEME.fontMono),
    baseSize: asEnum(theme.baseSize, BASE_SIZE_OPTIONS, FINAL_STAGE_THEME.baseSize),
    typeScale: asEnum(theme.typeScale, SCALE_OPTIONS, FINAL_STAGE_THEME.typeScale),
    density: asEnum(theme.density, DENSITY_OPTIONS, FINAL_STAGE_THEME.density),
    radius: asNumber(theme.radius, FINAL_STAGE_THEME.radius, 0, 24),
    maxContentWidth: asNumber(theme.maxContentWidth, FINAL_STAGE_THEME.maxContentWidth, 920, 1600),
    motion: asEnum(theme.motion, MOTION_OPTIONS, FINAL_STAGE_THEME.motion),
    fxScanlines: asNumber(theme.fxScanlines, FINAL_STAGE_THEME.fxScanlines, 0, 100),
    fxNoise: asNumber(theme.fxNoise, FINAL_STAGE_THEME.fxNoise, 0, 100),
    fxVignette: asNumber(theme.fxVignette, FINAL_STAGE_THEME.fxVignette, 0, 100),
    fxGlow: asNumber(theme.fxGlow, FINAL_STAGE_THEME.fxGlow, 0, 100),
    fxRail: asNumber(theme.fxRail, FINAL_STAGE_THEME.fxRail, 0, 100),
    fxProgress: asNumber(theme.fxProgress, FINAL_STAGE_THEME.fxProgress, 0, 100),
    cardVariant: asEnum(theme.cardVariant, CARD_VARIANTS, FINAL_STAGE_THEME.cardVariant),
    cardElevation: asNumber(theme.cardElevation, FINAL_STAGE_THEME.cardElevation, 0, 100),
    cardHoverLift: asNumber(theme.cardHoverLift, FINAL_STAGE_THEME.cardHoverLift, 0, 24),
    cardCornerAccent: asBoolean(theme.cardCornerAccent, FINAL_STAGE_THEME.cardCornerAccent),
    cardTilt: asBoolean(theme.cardTilt, FINAL_STAGE_THEME.cardTilt),
    buttonStyle: asEnum(theme.buttonStyle, BUTTON_STYLE_OPTIONS, FINAL_STAGE_THEME.buttonStyle),
    sectionOrder: sanitizeSectionOrder(theme.sectionOrder),
  };
}
