import type { PropsWithChildren } from 'react';

export function QuoteSpotlightSection({ children, className = '', id }: PropsWithChildren<{ className?: string; id?: string }>) {
  return (
    <section
      id={id}
      data-home-section
      data-section-variant='quote-spotlight'
      className={`container-narrow section ${className}`.trim()}
    >
      <div className='rounded-[calc(var(--radius)+14px)] border border-[hsl(var(--accent)/0.35)] bg-[radial-gradient(circle_at_20%_20%,hsl(var(--accent)/0.09),transparent_55%),hsl(var(--surface))] px-6 py-10 md:px-10'>
        {children}
      </div>
    </section>
  );
}
