import { useMemo, useState } from 'react';
import type { Service } from '@/types';
import { formatMoney } from '@/lib/utils';
import { TALENTS, type TalentSlug } from '@/data/talents';
import { TalentTabs } from '@/components/TalentTab';

type Props = {
  services: Service[];
  selectedServiceId: number | null;
  onSelect: (service: Service) => void;
};

export function ServicePicker({ services, selectedServiceId, onSelect }: Props) {
  const [activeFilter, setActiveFilter] = useState<TalentSlug | 'all'>('all');

  const filtered = useMemo(
    () => services.filter(
      (service) => activeFilter === 'all' || (service.talents ?? []).includes(activeFilter),
    ),
    [activeFilter, services],
  );

  return (
    <div className='space-y-6'>
      <TalentTabs active={activeFilter} onChange={setActiveFilter} />

      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
        {filtered.map((service) => {
          const primarySlug = service.talents?.[0];
          const talent = primarySlug ? TALENTS.find((t) => t.slug === primarySlug) : undefined;
          const selected = service.id === selectedServiceId;
          return (
              <button
                key={service.id ?? service.slug}
                type='button'
                onClick={() => onSelect(service)}
                className={`card card-interactive min-w-0 text-left ${selected ? 'card-selected' : ''}`}
              >
              {talent && <p className='eyebrow mb-2'>{talent.label}</p>}
              <p className='font-display text-2xl'>{service.name}</p>
              <p className='price mt-1 text-sm'>
                {formatMoney(service.price_cents)}
                {service.price_unit && <span className='ml-1 text-xs font-normal'>/ {service.price_unit}</span>}
              </p>
              <p className='muted mt-3 text-base leading-relaxed'>{service.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
