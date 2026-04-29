import { useMemo, useState } from 'react';
import type { Service } from '@/types';
import { formatMoney } from '@/lib/utils';
import { TALENTS, classifyService, type TalentSlug } from '@/data/talents';
import { TalentTabs } from '@/components/TalentTab';

type Props = {
  services: Service[];
  selectedServiceId: number | null;
  onSelect: (service: Service) => void;
};

export function ServicePicker({ services, selectedServiceId, onSelect }: Props) {
  const [activeFilter, setActiveFilter] = useState<TalentSlug | 'all'>('all');

  const servicesWithSlug = useMemo(
    () => services.map((service) => ({
      service,
      talentSlug: classifyService(service.name, service.slug, service.description ?? ''),
    })),
    [services],
  );

  const filtered = useMemo(
    () => servicesWithSlug.filter(
      ({ talentSlug }) => activeFilter === 'all' || talentSlug === activeFilter,
    ),
    [activeFilter, servicesWithSlug],
  );

  return (
    <div className='space-y-6'>
      <TalentTabs active={activeFilter} onChange={setActiveFilter} />

      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
        {filtered.map(({ service, talentSlug }) => {
          const talent = TALENTS.find((t) => t.slug === talentSlug);
          const selected = service.id === selectedServiceId;
          return (
              <button
                key={service.id ?? service.slug}
                type='button'
                onClick={() => onSelect(service)}
                className={`card card-interactive min-w-0 text-left ${selected ? 'card-selected' : ''}`}
              >
              <p className='eyebrow mb-2'>{talent?.label ?? talentSlug}</p>
              <p className='font-display text-2xl'>{service.name}</p>
              <p className='price mt-1 text-sm'>{formatMoney(service.price_cents)}</p>
              <p className='muted mt-3 text-base leading-relaxed'>{service.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
