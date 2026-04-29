import type { GalleryItem } from '@/types';
import { GalleryItemCard } from './GalleryItem';

export function GalleryGrid({ items }: { items: GalleryItem[] }) {
  return <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>{items.map((item) => <GalleryItemCard key={item.id ?? item.r2_key} item={item} />)}</div>;
}
