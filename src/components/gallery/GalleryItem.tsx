import type { GalleryItem } from '@/types';

export function GalleryItemCard({ item }: { item: GalleryItem }) {
  return (
    <figure className='overflow-hidden rounded-lg border border-border'>
      <img src={item.thumb_url ?? item.r2_key} alt={item.alt_text || item.title} className='h-56 w-full object-cover' />
      <figcaption className='p-2 text-sm'>{item.title}</figcaption>
    </figure>
  );
}
