import type { PropsWithChildren } from 'react';

export function OffsetGridSection({ children, className = '', id }: PropsWithChildren<{ className?: string; id?: string }>) {
  return (
    <section
      id={id}
      data-home-section
      data-section-variant='offset-grid'
      className={`section container-narrow bg-[linear-gradient(180deg,hsl(var(--surface)/0.32),transparent)] ${className}`.trim()}
    >
      {children}
    </section>
  );
}
