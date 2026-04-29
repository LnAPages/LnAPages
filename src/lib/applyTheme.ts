import type { ThemeConfig } from '@/lib/theme';
import { hexToHsl } from '@/lib/theme';

const DENSITY_SCALE: Record<ThemeConfig['density'], string> = {
  compact: '0.9',
  default: '1',
  spacious: '1.12',
};

const BASE_SIZE: Record<ThemeConfig['baseSize'], string> = {
  sm: '15px',
  md: '17px',
  lg: '19px',
};

const TYPE_SCALE: Record<ThemeConfig['typeScale'], string> = {
  tight: '0.95',
  balanced: '1',
  dramatic: '1.08',
};

const FONT_STACKS: Record<ThemeConfig['fontDisplay'], string> = {
  'playfair-display': '"Playfair Display", Georgia, serif',
  fraunces: '"Fraunces", "Playfair Display", Georgia, serif',
  'cormorant-garamond': '"Cormorant Garamond", Georgia, serif',
  inter: 'Inter, system-ui, sans-serif',
  'plus-jakarta-sans': '"Plus Jakarta Sans", Inter, system-ui, sans-serif',
  'dm-sans': '"DM Sans", Inter, system-ui, sans-serif',
  'jetbrains-mono': '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  'space-grotesk': '"Space Grotesk", Inter, system-ui, sans-serif',
  fredoka: '"Fredoka", "Nunito", system-ui, sans-serif',
  nunito: '"Nunito", system-ui, sans-serif',
  caveat: '"Caveat", cursive',
  quicksand: '"Quicksand", system-ui, sans-serif',
  bungee: '"Bungee", system-ui, sans-serif',
  vt323: '"VT323", "Courier New", monospace',
  'press-start-2p': '"Press Start 2P", ui-monospace, monospace',
  'space-mono': '"Space Mono", ui-monospace, monospace',
};

function percent(value: number): string {
  return `${Math.min(100, Math.max(0, value))}`;
}

export function applyTheme(theme: ThemeConfig): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Colors
  root.style.setProperty('--accent', hexToHsl(theme.accent));
  root.style.setProperty('--accent-hover', hexToHsl(theme.accentHover));
  root.style.setProperty('--accent-foreground', hexToHsl(theme.accentForeground));
  root.style.setProperty('--background', hexToHsl(theme.background));
  root.style.setProperty('--foreground', hexToHsl(theme.foreground));
  root.style.setProperty('--surface', hexToHsl(theme.surface));
  root.style.setProperty('--surface-2', hexToHsl(theme.surface2));
  root.style.setProperty('--surface-3', hexToHsl(theme.surface3));
  root.style.setProperty('--border', hexToHsl(theme.border));
  root.style.setProperty('--muted-foreground', hexToHsl(theme.mutedForeground));
  root.style.setProperty('--ring', hexToHsl(theme.ring));
  root.style.setProperty('--overlay', hexToHsl(theme.overlay));
  root.style.setProperty('--primary', hexToHsl(theme.foreground));
  root.style.setProperty('--primary-foreground', hexToHsl(theme.background));

  // Typography
  root.style.setProperty('--font-display', FONT_STACKS[theme.fontDisplay]);
  root.style.setProperty('--font-serif', FONT_STACKS[theme.fontSerif]);
  root.style.setProperty('--font-sans', FONT_STACKS[theme.fontSans]);
  root.style.setProperty('--font-mono', FONT_STACKS[theme.fontMono]);
  root.style.setProperty('--font-base-size', BASE_SIZE[theme.baseSize]);
  root.style.setProperty('--type-scale', TYPE_SCALE[theme.typeScale]);

  // Layout
  root.style.setProperty('--density-scale', DENSITY_SCALE[theme.density] ?? '1');
  root.style.setProperty('--radius', `${theme.radius}px`);
  root.style.setProperty('--radius-lg', `${Math.min(theme.radius * 2, 24)}px`);
  root.style.setProperty('--max-content-width', `${theme.maxContentWidth}px`);

  // FX
  root.style.setProperty('--fx-scanlines', percent(theme.fxScanlines));
  root.style.setProperty('--fx-noise', percent(theme.fxNoise));
  root.style.setProperty('--fx-vignette', percent(theme.fxVignette));
  root.style.setProperty('--fx-glow', percent(theme.fxGlow));
  root.style.setProperty('--fx-rail', percent(theme.fxRail));
  root.style.setProperty('--fx-progress', percent(theme.fxProgress));

  // Cards
  root.style.setProperty('--card-elevation', `${Math.min(100, Math.max(0, theme.cardElevation))}`);
  root.style.setProperty('--card-hover-lift', `${Math.min(24, Math.max(0, theme.cardHoverLift))}`);
  root.setAttribute('data-card-variant', theme.cardVariant);
  root.setAttribute('data-card-corner-accent', theme.cardCornerAccent ? 'on' : 'off');
  root.setAttribute('data-card-tilt', theme.cardTilt ? 'on' : 'off');
  root.setAttribute('data-button-style', theme.buttonStyle);

  // Motion + section order
  root.setAttribute('data-motion', theme.motion);
  root.setAttribute('data-section-order', theme.sectionOrder.join(','));
}
