import type { PropsWithChildren } from 'react';

export function MasonryShowcaseSection({ children, className = '', id }: PropsWithChildren<{ className?: string; id?: string }>) {
  return (
    <section
      id={id}
      data-home-section
      data-section-variant='masonry-showcase'
      className={`section border-y border-border/60 bg-[linear-gradient(120deg,hsl(var(--surface-2)/0.75),hsl(var(--background)/0.92))] ${className}`.trim()}
    >
      {children}
    </section>
  );
}
