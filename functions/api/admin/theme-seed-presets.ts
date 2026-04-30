import { ok, requireAdmin } from '../../lib/http';
import type { Env } from '../../lib/types';

// 5 cutesy presets seeded into D1 theme_presets table.
// Mirrors the new entries added to BRAND_PRESETS in src/lib/theme.ts so the
// admin UI can discover them server-side and remix without a redeploy.

type SeedPreset = {
  id: string;
  label: string;
  vibe_description: string;
  theme_json: string;
};

const SEED_PRESETS: SeedPreset[] = [
  {
    id: 'kawaii-soft',
    label: 'Kawaii Soft',
    vibe_description: 'pastel puffy clouds, marshmallow buttons, hand-drawn warmth',
    theme_json: JSON.stringify({
      mode: 'light', density: 'spacious', baseSize: 'md', typeScale: 'comfy', radius: 'pillow',
      bg: '#fff5f9', surface: '#ffe1ee', surface2: '#ffd1e3', text: '#3a2733', textMuted: '#7a5e6e',
      accent: '#ff9ec3', accentForeground: '#3a2733', border: '#ffc6dc',
      ring: '#ff7eb0', overlay: '#ffe1ee',
      fontSerif: 'fraunces', fontSans: 'nunito', fontMono: 'space-mono', fontDisplay: 'fredoka',
    }),
  },
  {
    id: 'paper-scrapbook',
    label: 'Paper Scrapbook',
    vibe_description: 'torn-paper edges, masking-tape accents, journaling type',
    theme_json: JSON.stringify({
      mode: 'light', density: 'default', baseSize: 'md', typeScale: 'editorial', radius: 'soft',
      bg: '#fbf6ec', surface: '#f3ead7', surface2: '#e9dcc0', text: '#2a2520', textMuted: '#6b6354',
      accent: '#c2410c', accentForeground: '#fbf6ec', border: '#d6c8a9',
      ring: '#a3370a', overlay: '#f3ead7',
      fontSerif: 'cormorant-garamond', fontSans: 'plus-jakarta-sans', fontMono: 'jetbrains-mono', fontDisplay: 'caveat',
    }),
  },
  {
    id: 'risograph-zine',
    label: 'Risograph Zine',
    vibe_description: 'two-color overprint, paper grain, DIY zine energy',
    theme_json: JSON.stringify({
      mode: 'light', density: 'compact', baseSize: 'sm', typeScale: 'tight', radius: 'crisp',
      bg: '#f7f4ee', surface: '#ece6d9', surface2: '#dbd2bf', text: '#1a1a1a', textMuted: '#4a4a4a',
      accent: '#0044ff', accentForeground: '#fff7e0', border: '#1a1a1a',
      ring: '#0044ff', overlay: '#ece6d9',
      fontSerif: 'space-grotesk', fontSans: 'space-grotesk', fontMono: 'jetbrains-mono', fontDisplay: 'bungee',
    }),
  },
  {
    id: 'retro-arcade',
    label: 'Retro Arcade',
    vibe_description: 'CRT scanlines, neon coin-op cabinet, 8-bit display type',
    theme_json: JSON.stringify({
      mode: 'dark', density: 'default', baseSize: 'sm', typeScale: 'tight', radius: 'crisp',
      bg: '#0a0014', surface: '#1a0a2e', surface2: '#2d1b4e', text: '#ffeb3b', textMuted: '#a78bfa',
      accent: '#ff00ff', accentForeground: '#0a0014', border: '#7c3aed',
      ring: '#ff00ff', overlay: '#1a0a2e',
      fontSerif: 'press-start-2p', fontSans: 'vt323', fontMono: 'vt323', fontDisplay: 'press-start-2p',
    }),
  },
  {
    id: 'dreamcore-y2k',
    label: 'Dreamcore Y2K',
    vibe_description: 'iridescent gradients, frosted glass, early-2000s web nostalgia',
    theme_json: JSON.stringify({
      mode: 'dark', density: 'spacious', baseSize: 'md', typeScale: 'comfy', radius: 'pillow',
      bg: '#1a0d2e', surface: '#2d1b4e', surface2: '#3d2a6e', text: '#f0f4ff', textMuted: '#b4a8d8',
      accent: '#7df9ff', accentForeground: '#1a0d2e', border: '#7c3aed',
      ring: '#7df9ff', overlay: '#2d1b4e',
      fontSerif: 'quicksand', fontSans: 'quicksand', fontMono: 'space-mono', fontDisplay: 'fredoka',
    }),
  },
];

export const onRequestPost: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const now = Date.now();
  const stmts = SEED_PRESETS.map((p) =>
    context.env.LNAPAGES_DB
      .prepare(
        'INSERT INTO theme_presets (id, label, vibe_description, theme_json, is_builtin, created_at, updated_at) ' +
        'VALUES (?, ?, ?, ?, 1, ?, ?) ' +
        'ON CONFLICT(id) DO UPDATE SET label = excluded.label, vibe_description = excluded.vibe_description, theme_json = excluded.theme_json, updated_at = excluded.updated_at',
      )
      .bind(p.id, p.label, p.vibe_description, p.theme_json, now, now),
  );
  await context.env.LNAPAGES_DB.batch(stmts);
  return ok({ seeded: SEED_PRESETS.length, ids: SEED_PRESETS.map((p) => p.id) });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const result = await context.env.LNAPAGES_DB
    .prepare('SELECT id, label, vibe_description, is_builtin, updated_at FROM theme_presets ORDER BY label')
    .all();
  return ok({ presets: result.results ?? [] });
};
