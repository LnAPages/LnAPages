import type { GalleryItem } from '@/types';

export function SortableGrid({ items }: { items: GalleryItem[] }) {
  return <div className='grid gap-3 sm:grid-cols-2'>{items.map((item) => <div key={item.id ?? item.r2_key} className='rounded border border-border p-3'>{item.title || item.r2_key}</div>)}</div>;
}
