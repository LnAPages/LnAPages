import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { TALENTS, type TalentSlug } from '@/data/talents';
import type { Service } from '@/types';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import { TalentTabs } from '@/components/TalentTab';
import { ReadingProgress } from '@/components/fx/ReadingProgress';

export default function Services() {
  const [searchParams, setSearchParams] = useSearchParams();
  const talentParam = searchParams.get('talent');
  const activeFilter: TalentSlug | 'all' = (talentParam as TalentSlug) ?? 'all';

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['services', talentParam],
    queryFn: () => {
      const qs = talentParam ? `?talent=${encodeURIComponent(talentParam)}` : '';
      return api.get<Service[]>(`/services${qs}`);
    },
  });

  const activeTalent = TALENTS.find((t) => t.slug === activeFilter);

  const handleTabChange = (slug: TalentSlug | 'all') => {
    if (slug === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ talent: slug });
    }
  };

  if (isLoading) return <p className='muted'>Loading services...</p>;
  if (error) return <p className='muted'>Failed to load services.</p>;

  return (
    <>
      <ReadingProgress />
      <div className='container-narrow section space-y-10'>
        <TalentTabs active={activeFilter} onChange={handleTabChange} />

        {activeTalent && (
          <div className='flex items-baseline gap-4'>
            <h1 className='font-display text-2xl'>{activeTalent.label}</h1>
            <Link to='/services' className='text-xs uppercase tracking-[0.2em] text-[hsl(var(--accent))]'>
              View all services
            </Link>
          </div>
        )}

        {data.length === 0 ? (
          <p className='muted'>
            {activeTalent
              ? <>No {activeTalent.label.toLowerCase()} services yet — <Link to='/services' className='text-[hsl(var(--accent))]'>view all services</Link>.</>
              : 'No services published yet.'}
          </p>
        ) : (
          <section className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
            {data.map((service) => {
              const primarySlug = service.talents?.[0];
              const talent = primarySlug ? TALENTS.find((t) => t.slug === primarySlug) : undefined;
              return (
                <article key={service.id ?? service.slug} className='card flex h-full min-w-0 flex-col gap-4'>
                  <div className='min-w-0 space-y-2'>
                    {talent && <p className='eyebrow'>{talent.label}</p>}
                    <h2 className='font-display text-3xl'>{service.name}</h2>
                    <p className='price text-base'>
                      {formatMoney(service.price_cents)}
                      {service.price_unit && <span className='ml-1 text-sm font-normal text-[hsl(var(--muted-foreground))]'>/ {service.price_unit}</span>}
                    </p>
                    <p className='muted'>{service.description}</p>
                  </div>

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
        )}
      </div>
    </>
  );
}
