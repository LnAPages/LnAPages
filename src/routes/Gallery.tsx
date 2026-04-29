import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GalleryItem } from '@/types';
import { api } from '@/lib/api';
import { GalleryGrid } from '@/components/gallery/GalleryGrid';
import { TalentTabs } from '@/components/TalentTab';
import { ReadingProgress } from '@/components/fx/ReadingProgress';
import type { TalentSlug } from '@/data/talents';
import { TALENTS } from '@/data/talents';

export default function Gallery() {
  const { data = [], isLoading, error } = useQuery({ queryKey: ['gallery'], queryFn: () => api.get<GalleryItem[]>('/gallery') });
  const [activeFilter, setActiveFilter] = useState<TalentSlug | 'all'>('all');

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return data;
    const talent = TALENTS.find((t) => t.slug === activeFilter);
    if (!talent) return data;
    return data.filter((item) => {
      const cat = (item.category ?? '').toLowerCase();
      const tags = Array.isArray(item.tags) ? (item.tags as string[]).join(' ').toLowerCase() : '';
      return (
        cat === activeFilter ||
        cat === talent.label.toLowerCase() ||
        cat.includes(activeFilter) ||
        tags.includes(activeFilter)
      );
    });
  }, [data, activeFilter]);

  if (isLoading) return <p>Loading gallery...</p>;
  if (error) return <p>Failed to load gallery.</p>;
  if (data.length === 0) return <p>No images yet.</p>;

  return (
    <>
      <ReadingProgress />
      <div className='container-narrow section space-y-6'>
        <TalentTabs active={activeFilter} onChange={setActiveFilter} />
        <GalleryGrid items={filteredItems} />
      </div>
    </>
  );
}
