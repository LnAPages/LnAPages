import type { GalleryItem } from '@/types';

export function Lightbox({ item, onClose }: { item: GalleryItem | null; onClose: () => void }) {
  if (!item) return null;
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4' onClick={onClose} role='button' tabIndex={0}>
      <img src={item.r2_key} alt={item.alt_text || item.title} className='max-h-full max-w-full' />
    </div>
  );
}
