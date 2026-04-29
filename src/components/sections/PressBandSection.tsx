import type { PropsWithChildren } from 'react';

export function PressBandSection({ children, className = '', id }: PropsWithChildren<{ className?: string; id?: string }>) {
  return (
    <section
      id={id}
      data-home-section
      data-section-variant='press-band'
      className={`container-narrow section ${className}`.trim()}
    >
      <div className='card border-border/80 bg-[hsl(var(--surface)/0.45)]'>
        {children}
      </div>
    </section>
  );
}
