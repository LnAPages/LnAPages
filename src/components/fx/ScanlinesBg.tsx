export function ScanlinesBg({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`.trim()}
      style={{
        opacity: 'calc(var(--fx-scanlines) / 100)',
        backgroundImage: 'repeating-linear-gradient(to bottom, hsl(var(--foreground)/0.16) 0px, hsl(var(--foreground)/0.16) 1px, transparent 2px, transparent 4px)',
      }}
    />
  );
}
