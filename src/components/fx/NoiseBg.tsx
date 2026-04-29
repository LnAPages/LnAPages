const grainSvg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" stitchTiles="stitch"/></filter><rect width="120" height="120" filter="url(#n)" opacity="1"/></svg>');

export function NoiseBg({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 mix-blend-soft-light ${className}`.trim()}
      style={{
        opacity: 'calc(var(--fx-noise) / 100)',
        backgroundImage: `url("data:image/svg+xml,${grainSvg}")`,
      }}
    />
  );
}
