export function GlowMeshBg({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`.trim()}
      style={{
        opacity: 'calc(var(--fx-glow) / 100)',
        backgroundImage:
          'radial-gradient(circle at 18% 24%, hsl(var(--accent)/0.38), transparent 52%), radial-gradient(circle at 82% 12%, hsl(var(--accent)/0.22), transparent 42%), radial-gradient(circle at 50% 88%, hsl(var(--accent)/0.18), transparent 48%)',
      }}
    />
  );
}
