import { useEffect, useRef, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { useTheme } from '@/hooks/useTheme';
import { applyTheme } from '@/lib/applyTheme';
import {
  BASE_SIZE_OPTIONS,
  BRAND_PRESETS,
  BUTTON_STYLE_OPTIONS,
  CARD_VARIANTS,
  DENSITY_OPTIONS,
  FONT_CHOICES,
  FONT_LABELS,
  SCALE_OPTIONS,
  FINAL_STAGE_THEME,
  isValidHex,
  sanitizeTheme,
  type BrandPreset,
  type SectionVariant,
  type ThemeConfig,
} from '@/lib/theme';
import { GlowMeshBg } from '@/components/fx/GlowMeshBg';
import { NoiseBg } from '@/components/fx/NoiseBg';
import { ScanlinesBg } from '@/components/fx/ScanlinesBg';
import { VignetteBg } from '@/components/fx/VignetteBg';
import ThemeFx from './ThemeFx';
import { useSearchParams } from 'react-router-dom';

type ThemeTab = 'color' | 'typography' | 'layout' | 'fx' | 'fx-gallery' | 'cards' | 'sections' | 'presets';

type ColorKey =
  | 'accent'
  | 'accentHover'
  | 'accentForeground'
  | 'background'
  | 'foreground'
  | 'surface'
  | 'surface2'
  | 'surface3'
  | 'border'
  | 'mutedForeground'
  | 'ring'
  | 'overlay';

const TABS: Array<{ id: ThemeTab; label: string }> = [
  { id: 'color', label: 'Color' },
  { id: 'typography', label: 'Typography' },
  { id: 'layout', label: 'Layout' },
  { id: 'fx', label: 'FX' },
  { id: 'fx-gallery', label: 'FX Gallery' },
  { id: 'cards', label: 'Cards' },
  { id: 'sections', label: 'Sections' },
  { id: 'presets', label: 'Presets' },
];

const COLOR_FIELDS: Array<{ key: ColorKey; label: string }> = [
  { key: 'accent', label: 'Accent' },
  { key: 'accentHover', label: 'Accent Hover' },
  { key: 'accentForeground', label: 'Accent Foreground' },
  { key: 'background', label: 'Background' },
  { key: 'foreground', label: 'Foreground' },
  { key: 'surface', label: 'Surface' },
  { key: 'surface2', label: 'Surface 2' },
  { key: 'surface3', label: 'Surface 3' },
  { key: 'border', label: 'Border' },
  { key: 'mutedForeground', label: 'Muted Text' },
  { key: 'ring', label: 'Ring' },
  { key: 'overlay', label: 'Overlay' },
];

const SECTION_LABELS: Record<SectionVariant, string> = {
  'offset-grid': 'offset grid',
  'masonry-showcase': 'masonry showcase',
  'press-band': 'press band',
  'quote-spotlight': 'quote spotlight',
  'cta-stage': 'cta stage',
};

// ── Color palette extractor ────────────────────────────────────────────────
function extractDominantColors(imageData: ImageData, count = 6): string[] {
  const { data, width, height } = imageData;
  const step = Math.max(1, Math.floor((width * height) / 2000));
  const buckets = new Map<string, number>();
  for (let i = 0; i < data.length; i += 4 * step) {
    const r = Math.round(data[i] / 32) * 32;
    const g = Math.round(data[i + 1] / 32) * 32;
    const b = Math.round(data[i + 2] / 32) * 32;
    if (data[i + 3] < 128) continue;
    const key = `${r},${g},${b}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
  const results: string[] = [];
  const chosen: [number, number, number][] = [];
  for (const [key] of sorted) {
    if (results.length >= count) break;
    const [r, g, b] = key.split(',').map(Number) as [number, number, number];
    const tooClose = chosen.some(([cr, cg, cb]) => Math.abs(r - cr) + Math.abs(g - cg) + Math.abs(b - cb) < 64);
    if (!tooClose) {
      results.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase());
      chosen.push([r, g, b]);
    }
  }
  return results;
}

function PaletteExtractor({ onApply }: { onApply: (colors: string[]) => void }) {
  const [swatches, setSwatches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(img.width, 200);
      canvas.height = Math.min(img.height, 200);
      const ctx = canvas.getContext('2d');
      if (!ctx) { setLoading(false); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setSwatches(extractDominantColors(imageData, 6));
      URL.revokeObjectURL(url);
      setLoading(false);
    };
    img.src = url;
  };

  return (
    <div className='card space-y-3'>
      <p className='eyebrow'>color palette extractor</p>
      <p className='text-sm text-[hsl(var(--muted-foreground))]'>Upload an inspiration image to extract dominant colors.</p>
      <input type='file' accept='image/*' onChange={handleFile} />
      {loading && <p className='text-xs text-[hsl(var(--muted-foreground))]'>Analyzing…</p>}
      {swatches.length > 0 && (
        <div className='space-y-2'>
          <div className='flex gap-2 flex-wrap'>
            {swatches.map((color) => (
              <span key={color} className='flex flex-col items-center gap-1'>
                <span className='h-8 w-8 rounded border border-border' style={{ backgroundColor: color }} />
                <span className='font-mono text-[10px]'>{color}</span>
              </span>
            ))}
          </div>
          <button type='button' className='btn-ghost text-xs' onClick={() => onApply(swatches)}>
            use as palette
          </button>
        </div>
      )}
    </div>
  );
}

// ── Surprise me ────────────────────────────────────────────────────────────
function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildSurprisePreset(): ThemeConfig {
  const palette = pickRandom(BRAND_PRESETS).theme;
  const fontDisplay = pickRandom(FONT_CHOICES);
  const fontSans = pickRandom(FONT_CHOICES);
  const fontMono = pickRandom(FONT_CHOICES);
  const buttonStyle = pickRandom(BUTTON_STYLE_OPTIONS);
  const cardVariant = pickRandom(CARD_VARIANTS);
  const radius = [0, 4, 8, 12, 20, 24][Math.floor(Math.random() * 6)];
  return sanitizeTheme({ ...palette, fontDisplay, fontSans, fontMono, buttonStyle, cardVariant, radius });
}

// ── Preset card ─────────────────────────────────────────────────────────────
function PresetCard({ preset, onApply }: { preset: BrandPreset; onApply: (preset: BrandPreset) => void }) {
  const swatchColors = [preset.theme.accent, preset.theme.background, preset.theme.surface, preset.theme.surface2, preset.theme.foreground, preset.theme.border];
  return (
    <button
      type='button'
      className='card card-interactive space-y-3 text-left'
      onClick={() => onApply(preset)}
    >
      <div className='flex items-center gap-3'>
        <span className='h-4 w-4 rounded-full border border-border' style={{ backgroundColor: preset.theme.accent }} />
        <p className='font-display text-xl font-semibold'>{preset.label}</p>
      </div>
      <div className='flex gap-1.5'>
        {swatchColors.map((swatch) => (
          <span key={`${preset.id}-${swatch}`} className='h-3 w-3 rounded-full border border-border' style={{ backgroundColor: swatch }} />
        ))}
      </div>
      <p className='font-mono text-[12px] lowercase text-[hsl(var(--muted-foreground))]'>
        {preset.vibe_description}
      </p>
    </button>
  );
}



function ThemeToast({ message }: { message: string }) {
  return (
    <div className='fixed bottom-6 right-6 z-[120] rounded border border-[hsl(var(--accent)/0.45)] bg-[hsl(var(--surface-2)/0.96)] px-4 py-3 text-sm shadow-lg'>
      {message}
    </div>
  );
}

export default function Theme() {
  const { theme, setTheme, isLoading, isSaving, error } = useTheme();
  const baseTheme = sanitizeTheme(theme);
  const [draftOverride, setDraftOverride] = useState<ThemeConfig | null>(null);
  const draft = draftOverride ?? baseTheme;

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = ((): ThemeTab => {
    const t = searchParams.get('tab') as ThemeTab | null;
    const valid: ThemeTab[] = ['color','typography','layout','fx','fx-gallery','cards','sections','presets'];
    return t && valid.includes(t) ? t : 'color';
  })();
  const [activeTab, _setActiveTab] = useState<ThemeTab>(initialTab);
  const setActiveTab = (t: ThemeTab) => {
    _setActiveTab(t);
    const next = new URLSearchParams(searchParams);
    if (t === 'color') next.delete('tab'); else next.set('tab', t);
    setSearchParams(next, { replace: true });
  };
  const [activeColor, setActiveColor] = useState<ColorKey>('accent');
  const [message, setMessage] = useState<string | null>(null);
  const [undoTheme, setUndoTheme] = useState<ThemeConfig | null>(null);
  const [surprisePreview, setSurprisePreview] = useState<ThemeConfig | null>(null);
  const surpriseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    applyTheme(surprisePreview ?? draft);
  }, [draft, surprisePreview]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 2200);
    return () => window.clearTimeout(timer);
  }, [message]);

  const updateDraft = (next: ThemeConfig) => {
    const sanitized = sanitizeTheme(next);
    setDraftOverride(sanitized);
    setSurprisePreview(null);
    applyTheme(sanitized);
  };

  const patchDraft = (patch: Partial<ThemeConfig>) => {
    updateDraft({ ...draft, ...patch });
  };

  const save = async (next?: ThemeConfig) => {
    const payload = sanitizeTheme(next ?? draft);
    try {
      setUndoTheme(baseTheme);
      const saved = await setTheme(payload);
      setDraftOverride(saved);
      const now = new Date();
      setMessage(`Theme saved · ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      return saved;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save theme.');
      return null;
    }
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.sectionOrder.length) return;
    const next = [...draft.sectionOrder];
    [next[index], next[target]] = [next[target], next[index]];
    patchDraft({ sectionOrder: next });
  };

  if (isLoading) return <div role='status' aria-live='polite'><p>Loading theme...</p></div>;

  const colorValue = draft[activeColor] as string;
  const validColor = isValidHex(colorValue);

  return (
    <section className='space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h1 className='text-2xl font-semibold'>Theme v2</h1>
        <div className='flex flex-wrap gap-2'>
          <button
            type='button'
            className='btn-ghost'
            onClick={() => {
              if (undoTheme) {
                updateDraft(undoTheme);
                void save(undoTheme);
                setUndoTheme(null);
                return;
              }
              updateDraft(baseTheme);
              setMessage('Reset to last saved theme.');
            }}
          >
            {undoTheme ? 'undo' : 'reset'}
          </button>
          <button type='button' className='btn-accent' disabled={isSaving} onClick={() => save()}>
            {isSaving ? 'saving…' : 'save'}
          </button>
        </div>
      </div>

      <nav className='flex flex-wrap gap-2' aria-label='Theme tabs'>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type='button'
            className={`pill ${activeTab === tab.id ? 'is-selected' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'color' ? (
        <div className='grid gap-6 lg:grid-cols-[20rem_1fr]'>
          <div className='card space-y-4'>
            <p className='eyebrow'>color picker · {COLOR_FIELDS.find((field) => field.key === activeColor)?.label.toLowerCase()}</p>
            <HexColorPicker
              color={validColor ? colorValue : '#000000'}
              onChange={(value) => patchDraft({ [activeColor]: value.toUpperCase() } as Partial<ThemeConfig>)}
            />
            <input
              value={colorValue}
              onChange={(event) => patchDraft({ [activeColor]: event.target.value } as Partial<ThemeConfig>)}
              className='w-full font-mono text-[13px] lowercase tracking-[0.04em]'
              aria-label={`${activeColor} hex color`}
            />
          </div>
          <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
            {COLOR_FIELDS.map((field) => {
              const swatch = draft[field.key] as string;
              return (
                <button
                  key={field.key}
                  type='button'
                  className={`card p-3 text-left ${activeColor === field.key ? 'card-selected' : ''}`}
                  onClick={() => setActiveColor(field.key)}
                >
                  <div className='mb-3 h-14 rounded border border-border' style={{ backgroundColor: isValidHex(swatch) ? swatch : '#888' }} />
                  <p className='eyebrow text-[12px]'>{field.label.toLowerCase()}</p>
                  <p className='font-mono text-[13px] lowercase tracking-[0.04em]'>{swatch}</p>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {activeTab === 'typography' ? (
        <div className='grid gap-6 lg:grid-cols-2'>
          <div className='card space-y-4'>
            <p className='eyebrow'>font families</p>
            <label className='space-y-2'>
              <span className='font-mono text-[13px] lowercase text-[hsl(var(--muted-foreground))]'>/ quick pairing</span>
              <select
                value={`${draft.fontDisplay}:${draft.fontSans}`}
                onChange={(event) => {
                  const [fontDisplay, fontSans] = event.target.value.split(':');
                  patchDraft({ fontDisplay: fontDisplay as ThemeConfig['fontDisplay'], fontSans: fontSans as ThemeConfig['fontSans'] });
                }}
              >
                <option value='playfair-display:inter'>Playfair + Inter</option>
                <option value='fraunces:dm-sans'>Fraunces + DM Sans</option>
                <option value='space-grotesk:plus-jakarta-sans'>Space Grotesk + Plus Jakarta Sans</option>
                <option value='cormorant-garamond:inter'>Cormorant + Inter</option>
              </select>
            </label>
            <div className='grid gap-3 sm:grid-cols-2'>
              {([
                ['fontDisplay', 'Display'],
                ['fontSerif', 'Serif'],
                ['fontSans', 'Sans'],
                ['fontMono', 'Mono'],
              ] as const).map(([key, label]) => (
                <label key={key} className='space-y-2'>
                  <span className='font-mono text-[13px] lowercase text-[hsl(var(--muted-foreground))]'>/{label.toLowerCase()}</span>
                  <select value={draft[key]} onChange={(event) => patchDraft({ [key]: event.target.value } as Partial<ThemeConfig>)}>
                    {FONT_CHOICES.map((font) => (
                      <option key={font} value={font}>{FONT_LABELS[font]}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <div className='space-y-2'>
              <p className='eyebrow'>base size</p>
              <div className='flex gap-2'>
                {BASE_SIZE_OPTIONS.map((size) => (
                  <button key={size} type='button' className={`pill flex-1 ${draft.baseSize === size ? 'is-selected' : ''}`} onClick={() => patchDraft({ baseSize: size })}>
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className='space-y-2'>
              <p className='eyebrow'>type scale</p>
              <div className='flex gap-2'>
                {SCALE_OPTIONS.map((scale) => (
                  <button key={scale} type='button' className={`pill flex-1 ${draft.typeScale === scale ? 'is-selected' : ''}`} onClick={() => patchDraft({ typeScale: scale })}>
                    {scale}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className='card space-y-4'>
            <p className='eyebrow'>live type preview</p>
            <div className='space-y-3 rounded border border-border p-4'>
              <p className='font-display text-4xl'>Final Stage Display</p>
              <p className='font-serif text-2xl'>Cinematic serif rhythm for longform copy.</p>
              <p className='font-sans text-base'>System and body voice across forms, menus, and controls.</p>
              <p className='font-mono text-[13px] lowercase tracking-[0.04em]'>/ jetbrains mono for eyebrows, captions, marquee</p>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'layout' ? (
        <div className='grid gap-6 lg:grid-cols-3'>
          <div className='card space-y-3'>
            <p className='eyebrow'>density</p>
            <div className='flex gap-2'>
              {DENSITY_OPTIONS.map((density) => (
                <button key={density} type='button' className={`pill flex-1 ${draft.density === density ? 'is-selected' : ''}`} onClick={() => patchDraft({ density })}>
                  {density}
                </button>
              ))}
            </div>
          </div>
          <div className='card space-y-3'>
            <p className='eyebrow'>radius · {draft.radius}px</p>
            <input type='range' min={0} max={24} step={1} value={draft.radius} onChange={(event) => patchDraft({ radius: Number(event.target.value) })} />
          </div>
          <div className='card space-y-3'>
            <p className='eyebrow'>max width · {draft.maxContentWidth}px</p>
            <input type='range' min={920} max={1600} step={20} value={draft.maxContentWidth} onChange={(event) => patchDraft({ maxContentWidth: Number(event.target.value) })} />
          </div>
        </div>
      ) : null}

      {activeTab === 'fx' ? (
        <div className='grid gap-6 lg:grid-cols-[1fr_21rem]'>
          <div className='grid gap-4 sm:grid-cols-2'>
            {([
              ['fxScanlines', 'scanlines'],
              ['fxNoise', 'noise'],
              ['fxVignette', 'vignette'],
              ['fxGlow', 'glow'],
              ['fxRail', 'dot rail'],
              ['fxProgress', 'progress bar'],
            ] as const).map(([key, label]) => (
              <label key={key} className='card space-y-3'>
                <p className='eyebrow'>{label} · {draft[key]}%</p>
                <input type='range' min={0} max={100} step={1} value={draft[key]} onChange={(event) => patchDraft({ [key]: Number(event.target.value) } as Partial<ThemeConfig>)} />
              </label>
            ))}
          </div>

          <div className='card space-y-3'>
            <p className='eyebrow'>fx preview</p>
            <div className='relative h-52 overflow-hidden rounded border border-border bg-[hsl(var(--surface-2))]'>
              <GlowMeshBg />
              <NoiseBg />
              <ScanlinesBg />
              <VignetteBg />
              <div className='relative z-10 flex h-full items-end p-4'>
                <div className='rounded border border-[hsl(var(--accent)/0.45)] bg-[hsl(var(--surface)/0.7)] px-3 py-2'>
                  <p className='font-mono text-[13px] lowercase'>/ layered fx tile</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'cards' ? (
        <div className='grid gap-6 lg:grid-cols-2'>
          <div className='card space-y-4'>
            <p className='eyebrow'>card controls</p>
            <div className='space-y-2'>
              <p className='font-mono text-[13px] lowercase text-[hsl(var(--muted-foreground))]'>/ variant</p>
              <div className='flex gap-2'>
                {CARD_VARIANTS.map((variant) => (
                  <button key={variant} type='button' className={`pill flex-1 ${draft.cardVariant === variant ? 'is-selected' : ''}`} onClick={() => patchDraft({ cardVariant: variant })}>
                    {variant}
                  </button>
                ))}
              </div>
            </div>
            <label className='space-y-2'>
              <p className='eyebrow'>elevation · {draft.cardElevation}</p>
              <input type='range' min={0} max={100} step={1} value={draft.cardElevation} onChange={(event) => patchDraft({ cardElevation: Number(event.target.value) })} />
            </label>
            <label className='space-y-2'>
              <p className='eyebrow'>hover lift · {draft.cardHoverLift}px</p>
              <input type='range' min={0} max={24} step={1} value={draft.cardHoverLift} onChange={(event) => patchDraft({ cardHoverLift: Number(event.target.value) })} />
            </label>
            <div className='grid grid-cols-2 gap-2'>
              <button type='button' className={`pill ${draft.cardCornerAccent ? 'is-selected' : ''}`} onClick={() => patchDraft({ cardCornerAccent: !draft.cardCornerAccent })}>
                corner accent {draft.cardCornerAccent ? 'on' : 'off'}
              </button>
              <button type='button' className={`pill ${draft.cardTilt ? 'is-selected' : ''}`} onClick={() => patchDraft({ cardTilt: !draft.cardTilt })}>
                tilt {draft.cardTilt ? 'on' : 'off'}
              </button>
            </div>

            <div className='space-y-2'>
              <p className='font-mono text-[13px] lowercase text-[hsl(var(--muted-foreground))]'>/ button styles</p>
              <div className='grid grid-cols-2 gap-2'>
                {BUTTON_STYLE_OPTIONS.map((style) => (
                  <button
                    key={style}
                    type='button'
                    className={`card p-2 text-left ${draft.buttonStyle === style ? 'card-selected' : ''}`}
                    onClick={() => patchDraft({ buttonStyle: style })}
                  >
                    <p className='mb-2 font-mono text-[12px] lowercase'>{style}</p>
                    <span className='btn-accent text-[11px]'>preview</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className='space-y-3'>
            <p className='eyebrow'>sample card</p>
            <article className='card card-interactive space-y-3'>
              <p className='eyebrow'>sample card</p>
              <h3 className='text-2xl'>final stage visual system</h3>
              <p className='muted'>Live card treatment updates with your selected variant, elevation, lift, and accents.</p>
              <button type='button' className='btn-ghost w-fit'>inspect style →</button>
            </article>
          </div>
        </div>
      ) : null}

      {activeTab === 'sections' ? (
        <div className='card space-y-4'>
          <p className='eyebrow'>section order</p>
          <div className='space-y-2'>
            {draft.sectionOrder.map((variant, index) => (
              <div key={variant} className='flex items-center justify-between rounded border border-border px-3 py-2'>
                <span className='font-mono text-[13px] lowercase'>/{SECTION_LABELS[variant]}</span>
                <div className='flex gap-2'>
                  <button type='button' className='pill px-2 py-1 text-xs' onClick={() => moveSection(index, -1)} disabled={index === 0}>↑</button>
                  <button type='button' className='pill px-2 py-1 text-xs' onClick={() => moveSection(index, 1)} disabled={index === draft.sectionOrder.length - 1}>↓</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === 'presets' ? (
        <div className='space-y-6'>
          {/* Surprise me + palette extractor row */}
          <div className='flex flex-wrap gap-3 items-start'>
            <div className='card space-y-3 flex-1 min-w-[240px]'>
              <p className='eyebrow'>surprise me</p>
              <p className='text-sm text-[hsl(var(--muted-foreground))]'>
                Generate a fresh random palette + font + shape combo to save or discard.
              </p>
              <div className='flex gap-2'>
                <button
                  type='button'
                  className='btn-ghost text-xs'
                  onClick={() => {
                    if (surpriseTimerRef.current) clearTimeout(surpriseTimerRef.current);
                    const generated = buildSurprisePreset();
                    setSurprisePreview(generated);
                    applyTheme(generated);
                    setMessage('Surprise preview — save to keep or click again to re-roll.');
                  }}
                >
                  ✦ surprise me
                </button>
                {surprisePreview && (
                  <>
                    <button
                      type='button'
                      className='btn-accent text-xs'
                      onClick={async () => {
                        updateDraft(surprisePreview);
                        await save(surprisePreview);
                        setSurprisePreview(null);
                        setMessage('Surprise preset saved!');
                      }}
                    >
                      save
                    </button>
                    <button
                      type='button'
                      className='rounded border border-border px-3 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--surface-2))]'
                      onClick={() => {
                        setSurprisePreview(null);
                        applyTheme(draft);
                      }}
                    >
                      discard
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className='flex-1 min-w-[240px]'>
              <PaletteExtractor
                onApply={(colors) => {
                  if (colors.length >= 2) {
                    patchDraft({ accent: colors[0], background: colors[1], foreground: colors[colors.length - 1] ?? FINAL_STAGE_THEME.foreground });
                  }
                }}
              />
            </div>
          </div>

          {/* Preset groups */}
          {[
            { label: 'editorial / cinematic', ids: ['final-stage-gold', 'obsidian-cyan', 'porcelain-ink', 'plum-neon', 'brass-studio'] },
            { label: 'cinema FX', ids: ['cinema-noir', 'vr-glitch-pop', 'holo-future'] },
            { label: 'cutesy / creative', ids: ['kawaii-soft', 'paper-scrapbook', 'risograph-zine', 'retro-arcade', 'dreamcore-y2k'] },
          ].map((group) => (
            <div key={group.label} className='space-y-3'>
              <p className='eyebrow'>{group.label}</p>
              <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                {BRAND_PRESETS.filter((p) => group.ids.includes(p.id)).map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    onApply={async (p) => {
                      const next = sanitizeTheme(p.theme);
                      updateDraft(next);
                      await save(next);
                      setMessage(`${p.label} applied. Reset to undo.`);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {activeTab === 'fx-gallery' ? (
        <ThemeFx />
      ) : null}


      {error ? <p className='text-sm text-red-400'>{error}</p> : null}
      {message ? <ThemeToast message={message} /> : null}
    </section>
  );
}
