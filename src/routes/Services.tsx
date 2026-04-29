import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import type { Service } from '@/types';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { TALENTS, classifyService, type TalentSlug } from '@/data/talents';
import { TalentTabs } from '@/components/TalentTab';
import { ReadingProgress } from '@/components/fx/ReadingProgress';

function buildInclusions(service: Service, slug: TalentSlug): string[] {
  const inclusions = [
    service.duration_minutes
      ? `${service.duration_minutes} minute${service.duration_minutes === 1 ? '' : 's'} production block`
      : 'Flexible session scope',
    'Pre-session planning and creative direction',
    'Professional edit and final delivery',
  ];
  if (slug === 'videography') inclusions[2] = 'Color-grade and platform-ready export';
  if (slug === 'photography') inclusions[2] = 'Retouched hero selects and gallery delivery';
  return inclusions;
}

export default function Services() {
  const { data = [], isLoading, error } = useQuery({ queryKey: ['services'], queryFn: () => api.get<Service[]>('/services') });
  const [activeFilter, setActiveFilter] = useState<TalentSlug | 'all'>('all');

  const servicesWithSlug = useMemo(
    () => data.map((service) => ({
      service,
      talentSlug: classifyService(service.name, service.slug, service.description ?? ''),
    })),
    [data],
  );

  const filteredServices = useMemo(
    () => servicesWithSlug.filter(({ talentSlug }) => activeFilter === 'all' || talentSlug === activeFilter),
    [activeFilter, servicesWithSlug],
  );

  if (isLoading) return <p className='muted'>Loading services...</p>;
  if (error) return <p className='muted'>Failed to load services.</p>;
  if (data.length === 0) return <p className='muted'>No services published yet.</p>;

  return (
    <>
      <ReadingProgress />
      <div className='container-narrow section space-y-10'>
        <TalentTabs active={activeFilter} onChange={setActiveFilter} />

        <section className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
          {filteredServices.map(({ service, talentSlug }) => {
            const talent = TALENTS.find((t) => t.slug === talentSlug);
            return (
              <article key={service.id ?? service.slug} className='card flex h-full min-w-0 flex-col gap-4'>
                <div className='min-w-0 space-y-2'>
                  <p className='eyebrow'>{talent?.label ?? talentSlug}</p>
                  <h2 className='font-display text-3xl'>{service.name}</h2>
                  <p className='price text-base'>{formatMoney(service.price_cents)}</p>
                  <p className='muted'>{service.description}</p>
                </div>

                <ul className='list-disc space-y-1 pl-5 text-base'>
                  {buildInclusions(service, talentSlug).map((inclusion) => (
                    <li key={inclusion}>{inclusion}</li>
                  ))}
                </ul>

                <Link
                  to={`/book?service=${encodeURIComponent(service.slug)}`}
                  aria-label={`Book ${service.name}`}
                  className='mt-auto font-sans text-xs uppercase tracking-[0.2em] text-[hsl(var(--accent))]'
                >
                  Book this &rarr;
                </Link>
              </article>
            );
          })}
        </section>
      </div>
    </>
  );
}
