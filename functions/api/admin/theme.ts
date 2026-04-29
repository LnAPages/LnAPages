import { z } from 'zod';
import { ok, parseJson, requireAdmin } from '../../lib/http';
import type { Env } from '../../lib/types';

const THEME_KEY = 'theme';
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

const FONT_ENUM = ['playfair-display', 'fraunces', 'cormorant-garamond', 'inter', 'plus-jakarta-sans', 'dm-sans', 'jetbrains-mono', 'space-grotesk', 'fredoka', 'nunito', 'caveat', 'quicksand', 'bungee', 'vt323', 'press-start-2p', 'space-mono'] as const;

const schema = z.object({
  version: z.union([z.literal(1), z.literal(2)]).optional(),
  accent: z.string().regex(HEX_RE),
  accentHover: z.string().regex(HEX_RE),
  accentForeground: z.string().regex(HEX_RE),
  background: z.string().regex(HEX_RE),
  foreground: z.string().regex(HEX_RE),
  surface: z.string().regex(HEX_RE),
  surface2: z.string().regex(HEX_RE),
  surface3: z.string().regex(HEX_RE),
  border: z.string().regex(HEX_RE),
  mutedForeground: z.string().regex(HEX_RE),
  ring: z.string().regex(HEX_RE),
  overlay: z.string().regex(HEX_RE),
  fontSerif: z.enum(FONT_ENUM),
  fontSans: z.enum(FONT_ENUM),
  fontMono: z.enum(FONT_ENUM),
  fontDisplay: z.enum(FONT_ENUM),
  baseSize: z.enum(['sm', 'md', 'lg']),
  typeScale: z.enum(['tight', 'balanced', 'dramatic']),
  density: z.enum(['compact', 'default', 'spacious']),
  radius: z.number().min(0).max(24),
  maxContentWidth: z.number().min(920).max(1600),
  motion: z.enum(['on', 'reduced']),
  fxScanlines: z.number().min(0).max(100),
  fxNoise: z.number().min(0).max(100),
  fxVignette: z.number().min(0).max(100),
  fxGlow: z.number().min(0).max(100),
  fxRail: z.number().min(0).max(100),
  fxProgress: z.number().min(0).max(100),
  cardVariant: z.enum(['outline', 'glass', 'solid']),
  cardElevation: z.number().min(0).max(100),
  cardHoverLift: z.number().min(0).max(24),
  cardCornerAccent: z.boolean(),
  cardTilt: z.boolean(),
  buttonStyle: z.enum(['solid', 'ghost', 'outline', 'pill', 'brutalist', 'glass']),
  sectionOrder: z.array(z.enum(['offset-grid', 'masonry-showcase', 'press-band', 'quote-spotlight', 'cta-stage'])).length(5),
});

async function saveTheme(env: Env, request: Request) {
  const payload = await parseJson(request, schema);
  const sectionOrder = Array.from(new Set(payload.sectionOrder));

  if (sectionOrder.length !== 5) {
    return Response.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'sectionOrder must contain each section exactly once' } }, { status: 400 });
  }

  const theme = {
    ...payload,
    version: 2 as const,
    accent: payload.accent.toUpperCase(),
    accentHover: payload.accentHover.toUpperCase(),
    accentForeground: payload.accentForeground.toUpperCase(),
    background: payload.background.toUpperCase(),
    foreground: payload.foreground.toUpperCase(),
    surface: payload.surface.toUpperCase(),
    surface2: payload.surface2.toUpperCase(),
    surface3: payload.surface3.toUpperCase(),
    border: payload.border.toUpperCase(),
    mutedForeground: payload.mutedForeground.toUpperCase(),
    ring: payload.ring.toUpperCase(),
    overlay: payload.overlay.toUpperCase(),
    sectionOrder,
  };

  await env.FNLSTG_CONFIG.put(THEME_KEY, JSON.stringify(theme));
  return ok(theme);
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  return saveTheme(context.env, context.request);
};
export const onRequestPut: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  return saveTheme(context.env, context.request);
};
