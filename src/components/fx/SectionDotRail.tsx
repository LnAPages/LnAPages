import { useEffect, useState } from 'react';

type Section = { id: string; label: string };

type Props = { sections: Section[] };

function isReducedMotion() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute('data-motion') === 'reduced';
}

export function SectionDotRail({ sections }: Props) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? '');

  useEffect(() => {
    const observers = sections.map(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(id);
        },
        { threshold: 0.4 },
      );
      observer.observe(el);
      return observer;
    });
    return () => observers.forEach((o) => o?.disconnect());
  }, [sections]);

  const reduced = isReducedMotion();

  return (
    <nav
      className='fixed left-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-3 xl:flex'
      aria-label='Section navigation'
      style={{ opacity: 'calc(var(--fx-rail) / 100)' }}
    >
      {sections.map(({ id, label }) => (
        <button
          key={id}
          type='button'
          aria-label={`Jump to ${label}`}
          onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })}
          className='group flex items-center gap-2'
        >
          <span
            className={`block h-1.5 w-1.5 rounded-full border ${
              active === id
                ? 'scale-150 border-[hsl(var(--accent))] bg-[hsl(var(--accent))]'
                : 'border-[hsl(var(--muted-foreground)/0.4)] bg-transparent group-hover:border-[hsl(var(--accent)/0.6)]'
            } ${reduced ? '' : 'transition-all duration-300'}`}
          />
        </button>
      ))}
    </nav>
  );
}
