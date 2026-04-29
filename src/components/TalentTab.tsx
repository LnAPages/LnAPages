import type { TalentSlug } from '@/data/talents';
import { TALENTS } from '@/data/talents';

type Props = {
  active: TalentSlug | 'all';
  onChange: (slug: TalentSlug | 'all') => void;
};

export function TalentTabs({ active, onChange }: Props) {
  const tabs: Array<{ slug: TalentSlug | 'all'; label: string }> = [
    { slug: 'all', label: 'All' },
    ...TALENTS.map((t) => ({ slug: t.slug, label: t.label })),
  ];

  return (
    <div
      className='flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border pb-3'
      role='tablist'
      aria-label='Filter by talent category'
    >
      {tabs.map((tab) => {
        const isActive = active === tab.slug;
        return (
          <button
            key={tab.slug}
            type='button'
            role='tab'
            aria-selected={isActive}
            onClick={() => onChange(tab.slug)}
            className={`relative pb-2 font-sans text-xs uppercase tracking-[0.24em] transition-colors ${
              isActive
                ? 'text-[hsl(var(--accent))]'
                : 'text-[hsl(var(--muted-foreground))] hover:text-foreground'
            }`}
          >
            {tab.label}
            {isActive ? (
              <span className='absolute inset-x-0 bottom-0 h-px bg-[hsl(var(--accent))]' aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
