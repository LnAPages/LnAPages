import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TALENTS } from '@/data/talents';
import { useBrandPublic } from '@/hooks/useBrand';
import type { MenuData } from '@/types';
import { api } from '@/lib/api';

const DEFAULT_FOOTER_TALENTS = TALENTS.map((t, i) => ({
  id: `talent-${t.slug}`,
  label: t.label,
  url: `/services?talent=${t.slug}`,
  new_tab: false,
  sort_order: i,
}));

export function Footer() {
  const { data: brand } = useBrandPublic();
  const { data: menu } = useQuery({
    queryKey: ['menu'],
    queryFn: () => api.get<MenuData>('/menu'),
  });

  const businessName = brand?.identity.business_name || brand?.identity.short_name || '';
  const tagline = brand?.identity.footer_blurb || '';
  const email = brand?.contact.email || '';
  const phone = brand?.contact.phone || '';
  const location = [brand?.contact.address.city, brand?.contact.address.region].filter(Boolean).join(', ') || brand?.contact.service_area || '';
  const copyrightNotice = brand?.legal.copyright_notice || '';

  const talents = menu?.talents && menu.talents.length > 0 ? menu.talents : DEFAULT_FOOTER_TALENTS;

  return (
    <footer className='mt-16 border-t border-border bg-[hsl(var(--background)/0.96)]'>
      <div className='container-narrow py-14'>
        <div className='grid gap-10 md:grid-cols-3'>
          <div className='space-y-3'>
            {businessName ? <p className='font-display text-3xl'>{businessName}</p> : null}
            {tagline ? <p className='muted max-w-sm'>{tagline}</p> : null}
          </div>

          <div className='space-y-3'>
            <p className='eyebrow'>Navigation</p>
            <nav className='space-y-2 text-lg'>
              <Link to='/' className='block hover:text-[hsl(var(--accent))]'>Home</Link>
              <Link to='/services' className='block hover:text-[hsl(var(--accent))]'>Services</Link>
              <Link to='/gallery' className='block hover:text-[hsl(var(--accent))]'>Gallery</Link>
              <Link to='/book' className='block hover:text-[hsl(var(--accent))]'>Book</Link>
            </nav>
            <div className='pt-3'>
              <p className='eyebrow mb-2'>Talents</p>
              <div className='flex flex-wrap items-center gap-x-1 gap-y-1'>
                {talents.map((talent, index) => (
                  <span key={talent.id} className='flex items-center'>
                    <Link
                      to={talent.url}
                      target={talent.new_tab ? '_blank' : undefined}
                      rel={talent.new_tab ? 'noreferrer' : undefined}
                      className='font-sans text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--accent))]'
                    >
                      {talent.label}
                    </Link>
                    {index < talents.length - 1 ? (
                      <span className='mx-2 text-[hsl(var(--accent)/0.5)] text-[10px]' aria-hidden>◆</span>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className='space-y-3'>
            <p className='eyebrow'>Contact</p>
            {email ? <p className='text-lg'>{email}</p> : null}
            {phone ? <p className='text-lg'>{phone}</p> : null}
            {location ? <p className='muted'>{location}</p> : null}
          </div>
        </div>

        <div className='my-8 h-px bg-[linear-gradient(90deg,transparent,hsl(var(--accent)),transparent)]' />

        <div className='flex flex-col gap-2 text-sm text-[hsl(var(--muted-foreground))] md:flex-row md:items-center md:justify-between'>
          {copyrightNotice ? <p>{copyrightNotice}</p> : null}
          {location ? <p className='font-sans uppercase tracking-[0.2em]'>Based in {location}</p> : null}
        </div>
      </div>
    </footer>
  );
}
