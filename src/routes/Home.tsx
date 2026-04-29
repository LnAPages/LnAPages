import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { TALENTS } from '@/data/talents';
import { SectionDotRail } from '@/components/fx/SectionDotRail';
import { GlowMeshBg } from '@/components/fx/GlowMeshBg';
import { NoiseBg } from '@/components/fx/NoiseBg';
import { ScanlinesBg } from '@/components/fx/ScanlinesBg';
import { VignetteBg } from '@/components/fx/VignetteBg';
import {
  CtaStageSection,
  MasonryShowcaseSection,
  OffsetGridSection,
  PressBandSection,
  QuoteSpotlightSection,
} from '@/components/sections';
import { useBrandPublic } from '@/hooks/useBrand';
import type { GalleryItem } from '@/types';
import { api } from '@/lib/api';

const sectionTransition = { duration: 0.6, ease: [0.16, 1, 0.3, 1] } as const;
const heroCopyTransition = { duration: 0.75, ease: [0.16, 1, 0.3, 1] } as const;
const HERO_MEDIA_DIMMED_OPACITY_CLASS = 'opacity-35';

const TALENT_OFFSETS = ['md:mt-0', 'md:mt-10', 'md:mt-20', 'md:mt-8', 'md:mt-16'] as const;
const TALENT_COL_SPANS = ['md:col-span-4', 'md:col-span-4', 'md:col-span-4', 'md:col-span-6', 'md:col-span-6'] as const;

const homeSections = [
  { id: 'services-grid', label: 'what we do' },
  { id: 'selected-work', label: 'selected work' },
  { id: 'press-band', label: 'as seen on' },
  { id: 'quote-spotlight', label: 'testimonial' },
  { id: 'cta-stage', label: 'book now' },
] as const;

function fadeRiseProps(delay = 0) {
  return {
    initial: { opacity: 0, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-8% 0px' },
    transition: { ...sectionTransition, delay },
  };
}

function readSectionOrderFromAttribute() {
  if (typeof document === 'undefined') return [];
  const raw = document.documentElement.getAttribute('data-section-order') ?? '';
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

export default function Home() {
  const orderedSectionRootRef = useRef<HTMLDivElement>(null);
  const { data: brand } = useBrandPublic();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [activeHeroMediaIndex, setActiveHeroMediaIndex] = useState(0);
  const businessName = brand?.identity.business_name || brand?.identity.short_name || '';
  const serviceArea = brand?.contact.service_area || [brand?.contact.address.city, brand?.contact.address.region].filter(Boolean).join(', ');
  const eyebrow = [businessName, serviceArea, brand?.identity.founded_year ? `est. ${brand.identity.founded_year}` : '']
    .filter(Boolean)
    .join(' · ')
    .toLowerCase();
  const tickerItems = (brand?.identity.credits_marquee ?? []).map((item) => item.trim()).filter(Boolean);
  const pressItems = (brand?.identity.press_logos ?? []).map((item) => item.trim()).filter(Boolean);
  const testimonial = brand?.identity.testimonials.find((entry) => entry.quote.trim()) ?? null;
  const heroMediaMode = brand?.identity.hero_media_mode ?? 'off';
  const heroMediaCount = Math.max(3, Math.min(12, brand?.identity.hero_media_count ?? 7));
  const heroVideoUrl = brand?.identity.hero_media_video_url?.trim() ?? '';
  const heroVideoPoster = brand?.identity.hero_media_poster_url?.trim() ?? '';
  const heroTagline = brand?.identity.tagline?.trim() ?? '';
  const heroParagraph = brand?.identity.hero_paragraph?.trim() ?? '';
  const closingCta = brand?.identity.closing_cta?.trim() ?? '';

  const { data: galleryItems = [] } = useQuery({
    queryKey: ['gallery'],
    queryFn: () => api.get<GalleryItem[]>('/gallery'),
    enabled: heroMediaMode === 'photo',
  });

  const heroPhotos = useMemo(
    () => galleryItems.filter((item) => (item.kind ?? 'image') === 'image').slice(0, heroMediaCount),
    [galleryItems, heroMediaCount],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setPrefersReducedMotion(mediaQuery.matches);
    apply();
    mediaQuery.addEventListener('change', apply);
    return () => mediaQuery.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (heroMediaMode !== 'photo' || heroPhotos.length <= 1 || prefersReducedMotion) return;
    const timer = window.setInterval(() => {
      setActiveHeroMediaIndex((current) => (current + 1) % heroPhotos.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [heroMediaMode, heroPhotos.length, prefersReducedMotion]);

  const visibleHeroMediaIndex = prefersReducedMotion ? 0 : (heroPhotos.length > 0 ? activeHeroMediaIndex % heroPhotos.length : 0);

  useEffect(() => {
    const sectionRoot = orderedSectionRootRef.current;
    if (!sectionRoot) return;

    const applySectionOrder = () => {
      const order = readSectionOrderFromAttribute();
      if (order.length === 0) return;
      const byVariant = new Map(
        Array.from(sectionRoot.querySelectorAll<HTMLElement>('[data-home-section][data-section-variant]'))
          .map((section) => [section.getAttribute('data-section-variant') ?? '', section]),
      );
      order.forEach((variant) => {
        const section = byVariant.get(variant);
        if (section) sectionRoot.appendChild(section);
      });
    };

    applySectionOrder();

    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.attributeName === 'data-section-order')) {
        applySectionOrder();
      }
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-section-order'] });

    return () => observer.disconnect();
  }, []);

  return (
    <div className='mx-[calc(50%-50vw)] w-screen overflow-hidden'>
      <SectionDotRail sections={homeSections.map((section) => ({ id: section.id, label: section.label }))} />

      <section className='relative min-h-[82svh] border-b border-border/60'>
        {heroMediaMode === 'photo' && heroPhotos.length > 0 ? (
          <div className='absolute inset-0 z-0 overflow-hidden'>
            {heroPhotos.map((item, index) => (
              <img
                key={`${item.id ?? item.r2_key}-${index}`}
                src={item.r2_key}
                alt={item.alt_text || ''}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${index === visibleHeroMediaIndex ? HERO_MEDIA_DIMMED_OPACITY_CLASS : 'opacity-0'}`}
              />
            ))}
            <div className='absolute inset-0 bg-[hsl(var(--overlay)/0.62)]' />
          </div>
        ) : null}
        {heroMediaMode === 'video' && heroVideoUrl ? (
          <div className='absolute inset-0 z-0 overflow-hidden'>
            <video
              className='h-full w-full object-cover'
              src={heroVideoUrl}
              poster={heroVideoPoster || undefined}
              muted
              playsInline
              autoPlay={!prefersReducedMotion}
              loop={!prefersReducedMotion}
            />
            <div className='absolute inset-0 bg-[hsl(var(--overlay)/0.62)]' />
          </div>
        ) : null}
        <GlowMeshBg />
        <NoiseBg />
        <ScanlinesBg />
        <VignetteBg />

        <div className='container-narrow relative z-10 flex min-h-[82svh] items-center py-16'>
          <motion.div
            className='max-w-5xl space-y-8'
            initial='hidden'
            animate='show'
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.14 } },
            }}
          >
            <motion.div
              variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
              transition={heroCopyTransition}
              className='space-y-4'
            >
              {eyebrow ? <p className='eyebrow'>{eyebrow}</p> : null}
              {eyebrow ? <div className='h-px w-64 bg-[linear-gradient(90deg,hsl(var(--accent)/0.1),hsl(var(--accent)),transparent)]' /> : null}
            </motion.div>

            {heroTagline ? (
              <motion.h1
                variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                transition={heroCopyTransition}
                className='max-w-5xl text-[clamp(2.9rem,7.8vw,6.6rem)] leading-[0.98]'
              >
                {heroTagline}
              </motion.h1>
            ) : null}

            {heroParagraph ? (
              <motion.p
                variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                transition={heroCopyTransition}
                className='max-w-[60ch] text-[clamp(1.2rem,2.1vw,1.7rem)] text-[hsl(var(--muted-foreground))]'
              >
                {heroParagraph}
              </motion.p>
            ) : null}

            <motion.div
              variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
              transition={heroCopyTransition}
              className='flex flex-wrap gap-3'
            >
              <Link to='/book' className='btn-accent'>book a session →</Link>
              <Link to='/gallery' className='btn-ghost'>see the work</Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {tickerItems.length > 0 ? (
        <section className='border-b border-border/60 py-3'>
          <div className='ticker-wrap'>
            <div className='ticker-track'>
              {[...tickerItems, ...tickerItems].map((item, index) => (
                <span key={`${item}-${index}`} className='ticker-item'>
                  {item}
                  <span aria-hidden className='ticker-sep'>◆</span>
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <div ref={orderedSectionRootRef}>
        <motion.div {...fadeRiseProps()}>
          <OffsetGridSection id='services-grid'>
            <div className='mb-8'>
              <p className='eyebrow'>what we do</p>
            </div>
            <div className='grid grid-cols-1 gap-6 md:grid-cols-12'>
              {TALENTS.map((talent, index) => (
                <article
                  key={talent.slug}
                  className={`group card card-interactive card-numbered ${TALENT_COL_SPANS[index]} ${TALENT_OFFSETS[index]} border-border/80`}
                >
                  <span className='card-numbered__number font-display italic text-[hsl(var(--accent))]'>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className='card-numbered__content space-y-3'>
                    <p className='eyebrow'>{talent.label.toLowerCase()}</p>
                    <h3 className='text-3xl'>{talent.blurb.split('.')[0]}</h3>
                    <div className='h-px w-20 bg-[hsl(var(--accent)/0.4)] transition-all duration-300 group-hover:w-28 group-hover:bg-[hsl(var(--accent))]' />
                    <p className='muted text-lg leading-relaxed'>{talent.blurb}</p>
                  </div>
                </article>
              ))}
            </div>
          </OffsetGridSection>
        </motion.div>

        <motion.div {...fadeRiseProps()}>
          <MasonryShowcaseSection id='selected-work'>
            <div className='container-narrow'>
              <div className='mb-8 flex items-end justify-between gap-4'>
                <p className='eyebrow'>selected work</p>
                <Link to='/gallery' className='font-mono text-[13px] lowercase tracking-[0.04em] text-[hsl(var(--accent))]'>
                  / view the gallery →
                </Link>
              </div>

              <div className='rounded border border-border/70 bg-surface-2/40 px-6 py-12 text-center'>
                <p className='eyebrow'>gallery updates live from admin curation</p>
                <p className='muted mt-3'>No featured items are pinned on home yet.</p>
              </div>
            </div>
          </MasonryShowcaseSection>
        </motion.div>

        {pressItems.length > 0 ? (
          <motion.div {...fadeRiseProps()}>
            <PressBandSection id='press-band'>
              <div className='flex flex-wrap items-center gap-4'>
                <p className='eyebrow'>as seen on</p>
                <div className='flex min-w-0 flex-wrap items-center gap-3 text-sm uppercase tracking-[0.24em] text-[hsl(var(--muted-foreground))]'>
                  {pressItems.map((item, index) => (
                    <span key={item} className='font-serif text-base italic'>
                      {item}
                      {index < pressItems.length - 1 ? <span className='px-3 text-[hsl(var(--accent))]'>◆</span> : null}
                    </span>
                  ))}
                </div>
              </div>
            </PressBandSection>
          </motion.div>
        ) : null}

        {testimonial?.quote ? (
          <motion.div {...fadeRiseProps()}>
            <QuoteSpotlightSection id='quote-spotlight'>
              <blockquote className='mx-auto max-w-5xl text-center'>
                <p className='font-display text-[clamp(2rem,4.2vw,3.9rem)] italic leading-tight'>
                  <span className='text-[hsl(var(--accent))]'>“</span>
                  {testimonial.quote}
                  <span className='text-[hsl(var(--accent))]'>”</span>
                </p>
                {testimonial.attribution ? <p className='eyebrow mt-6'>{testimonial.attribution}</p> : null}
              </blockquote>
            </QuoteSpotlightSection>
          </motion.div>
        ) : null}

        <motion.div {...fadeRiseProps()}>
          <CtaStageSection id='cta-stage'>
            <div className='container-narrow space-y-7'>
              {closingCta ? <h2 className='text-[clamp(2.4rem,5vw,4.2rem)]'>{closingCta}</h2> : null}
              {closingCta ? (
                <motion.div
                  className='mx-auto h-px w-40 origin-left bg-[hsl(var(--accent))]'
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true, margin: '-10% 0px' }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                />
              ) : null}
              <div>
                <Link to='/book' className='btn-accent'>book a session →</Link>
              </div>
            </div>
          </CtaStageSection>
        </motion.div>
      </div>
    </div>
  );
}
