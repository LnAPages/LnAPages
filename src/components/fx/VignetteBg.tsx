export function VignetteBg({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`.trim()}
      style={{
        opacity: 'calc(var(--fx-vignette) / 100)',
        backgroundImage: 'radial-gradient(ellipse at center, transparent 42%, hsl(var(--overlay) / 0.86) 100%)',
      }}
    />
  );
}
