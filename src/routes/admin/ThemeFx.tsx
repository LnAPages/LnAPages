import { useState } from 'react';

type FxEntry = {
  className: string;
  label: string;
  description: string;
  group: string;
};

const FX_ENTRIES: FxEntry[] = [
  // Focus & Lens
  { className: 'fx-diopter-focus', label: 'Diopter Focus',   description: 'Sharp word, surroundings blur',              group: 'Focus & Lens' },
  { className: 'fx-diopter-blur',  label: 'Diopter Blur',    description: 'This word blurs, rest stays sharp',          group: 'Focus & Lens' },
  { className: 'fx-focus-pull',    label: 'DoF Focus Pull',   description: 'Per-depth blur/scale on individual letters', group: 'Focus & Lens' },
  // Color & Light
  { className: 'fx-chroma',         label: 'Chromatic',       description: 'Static RGB channel split',                   group: 'Color & Light' },
  { className: 'fx-chroma-pulse',   label: 'Chroma Pulse',    description: 'Breathing RGB offset (3s loop)',             group: 'Color & Light' },
  { className: 'fx-chroma-scanline',label: 'Chroma Scanline', description: 'Wider chroma split for CRT combos',          group: 'Color & Light' },
  { className: 'fx-holo',          label: 'Holo',            description: 'Rainbow iridescence (6s loop)',               group: 'Color & Light' },
  { className: 'fx-holo-prism',    label: 'Holo Prism',      description: 'Prismatic RGB-edge fragments',               group: 'Color & Light' },
  { className: 'fx-holo-foil',     label: 'Holo Foil',       description: 'Metallic credit-card shimmer',               group: 'Color & Light' },
  { className: 'fx-echo-trail',    label: 'Echo Trail',      description: '4-layer ghost trail behind glyph',           group: 'Color & Light' },
  // Glitch & Signal
  { className: 'fx-glitch-hover',  label: 'Glitch Hover',    description: '400ms glitch burst on mouseover',            group: 'Glitch & Signal' },
  { className: 'fx-glitch-loop',   label: 'Glitch Loop',     description: 'Burst every ~8s automatically',              group: 'Glitch & Signal' },
  { className: 'fx-glitch-heavy',  label: 'Glitch Heavy',    description: 'Constant micro-glitching (use sparingly)',   group: 'Glitch & Signal' },
  { className: 'fx-shear-soft',    label: 'Shear Soft',      description: 'Gentle CRT rolling-sync shear',              group: 'Glitch & Signal' },
  { className: 'fx-shear-glitch',  label: 'Shear Glitch',    description: 'Random shear recomposes every 800ms',        group: 'Glitch & Signal' },
  { className: 'fx-snow',          label: 'Snow',            description: 'Light TV noise overlay (15%)',               group: 'Glitch & Signal' },
  { className: 'fx-snow-heavy',    label: 'Snow Heavy',      description: 'Full dead-channel noise effect',             group: 'Glitch & Signal' },
  { className: 'fx-dither-mosaic', label: 'Dither Mosaic',   description: 'Static hex-pixelation overlay',              group: 'Glitch & Signal' },
  { className: 'fx-dither-dissolve',label: 'Dither Dissolve','description': 'Pixelates on hover, clears on leave',      group: 'Glitch & Signal' },
  // Presets
  { className: 'fx-vr-corrupt',    label: 'VR Corrupt',      description: 'Chroma scanline + glitch loop + snow',       group: 'Presets' },
  { className: 'fx-tape-decay',    label: 'Tape Decay',      description: 'Shear + snow + echo trail',                  group: 'Presets' },
  { className: 'fx-holo-glitch',   label: 'Holo Glitch',     description: 'Holo prism + chroma pulse + glitch hover',   group: 'Presets' },
  { className: 'fx-cinema-bokeh',  label: 'Cinema Bokeh',    description: 'Diopter focus + DoF pull + subtle echo',     group: 'Presets' },
  { className: 'fx-dead-signal',   label: 'Dead Signal',     description: 'Snow heavy + shear glitch + chroma',         group: 'Presets' },
];

const GROUPS = ['Focus & Lens', 'Color & Light', 'Glitch & Signal', 'Presets'] as const;

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text);
}

export default function ThemeFx() {
  const [intensities, setIntensities] = useState<Record<string, number>>(() =>
    Object.fromEntries(FX_ENTRIES.map((fx) => [fx.className, 50])),
  );
  const [copied, setCopied] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>('all');

  const setIntensity = (className: string, value: number) => {
    setIntensities((prev) => ({ ...prev, [className]: value }));
  };

  const handleCopy = (className: string) => {
    copyToClipboard(className);
    setCopied(className);
    window.setTimeout(() => setCopied(null), 1500);
  };

  const visible = activeGroup === 'all' ? FX_ENTRIES : FX_ENTRIES.filter((fx) => fx.group === activeGroup);

  return (
    <section className='space-y-6'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-semibold'>Cinema FX Gallery</h1>
        <p className='muted text-sm'>
          Every <code className='font-mono text-xs'>fx-*</code> class applied to the word{' '}
          <strong className='font-display'>"CINEMA"</strong> — live intensity sliders + copy-to-clipboard.
          Wrap any text with{' '}
          <code className='font-mono text-xs'>
            {'<span class="fx-chroma" style="--fx-intensity: 60">word</span>'}
          </code>
          .
        </p>
      </div>

      {/* Group filter pills */}
      <nav className='flex flex-wrap gap-2' aria-label='FX group filter'>
        <button
          type='button'
          className={`pill ${activeGroup === 'all' ? 'is-selected' : ''}`}
          onClick={() => setActiveGroup('all')}
        >
          all
        </button>
        {GROUPS.map((group) => (
          <button
            key={group}
            type='button'
            className={`pill ${activeGroup === group ? 'is-selected' : ''}`}
            onClick={() => setActiveGroup(group)}
          >
            {group.toLowerCase()}
          </button>
        ))}
      </nav>

      {/* Card grid */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
        {visible.map((fx) => {
          const intensity = intensities[fx.className] ?? 50;
          return (
            <article key={fx.className} className='card space-y-4'>
              {/* FX preview */}
              <div className='flex min-h-[4.5rem] items-center justify-center rounded border border-border bg-[hsl(var(--surface-2))] px-3 py-4'>
                <span
                  className={`font-display text-3xl font-bold tracking-tight ${fx.className}`}
                  style={{ '--fx-intensity': intensity } as React.CSSProperties}
                >
                  CINEMA
                </span>
              </div>

              {/* Meta */}
              <div className='space-y-1'>
                <p className='eyebrow'>{fx.group.toLowerCase()}</p>
                <p className='font-sans text-sm font-medium'>{fx.label}</p>
                <p className='muted text-xs'>{fx.description}</p>
              </div>

              {/* Intensity slider */}
              <label className='space-y-1'>
                <span className='font-mono text-[11px] lowercase text-[hsl(var(--muted-foreground))]'>
                  / intensity · {intensity}
                </span>
                <input
                  type='range'
                  min={0}
                  max={100}
                  step={1}
                  value={intensity}
                  onChange={(e) => setIntensity(fx.className, Number(e.target.value))}
                  className='w-full'
                  aria-label={`${fx.label} intensity`}
                />
              </label>

              {/* Copy button */}
              <button
                type='button'
                className='btn-ghost w-full text-xs'
                onClick={() => handleCopy(fx.className)}
              >
                {copied === fx.className ? '✓ copied!' : `copy .${fx.className}`}
              </button>
            </article>
          );
        })}
      </div>

      {/* Usage reference */}
      <div className='card space-y-3'>
        <p className='eyebrow'>usage reference</p>
        <div className='space-y-2 text-sm'>
          <p className='font-sans text-[hsl(var(--muted-foreground))]'>
            Wrap any word or letter in a{' '}
            <code className='font-mono text-xs text-[hsl(var(--foreground))]'>&lt;span&gt;</code> with a{' '}
            <code className='font-mono text-xs text-[hsl(var(--foreground))]'>fx-*</code> class. Set{' '}
            <code className='font-mono text-xs text-[hsl(var(--foreground))]'>--fx-intensity</code> (0–100) to
            control the effect strength.
          </p>
          <pre className='overflow-x-auto rounded border border-border bg-[hsl(var(--surface-3))] px-3 py-2 font-mono text-[11px] text-[hsl(var(--foreground))]'>
            {`<span class="fx-chroma-pulse" style="--fx-intensity: 70">visuals</span>`}
          </pre>
          <pre className='overflow-x-auto rounded border border-border bg-[hsl(var(--surface-3))] px-3 py-2 font-mono text-[11px] text-[hsl(var(--foreground))]'>
            {`<span class="fx-cinema-bokeh" style="--fx-intensity: 60">sharp word</span>`}
          </pre>
          <p className='font-sans text-[hsl(var(--muted-foreground))]'>
            All effects respect <code className='font-mono text-xs'>prefers-reduced-motion</code> — animated
            glitches freeze to a static state, static iridescence and scanlines remain.
          </p>
        </div>
      </div>
    </section>
  );
}
