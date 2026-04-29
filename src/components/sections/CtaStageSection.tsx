import type { PropsWithChildren } from 'react';

export function CtaStageSection({ children, className = '', id }: PropsWithChildren<{ className?: string; id?: string }>) {
  return (
    <section
      id={id}
      data-home-section
      data-section-variant='cta-stage'
      className={`relative border-y border-border/60 bg-[hsl(var(--overlay)/0.95)] py-20 text-center ${className}`.trim()}
    >
      {children}
    </section>
  );
}
