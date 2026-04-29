export type GalleryKind = 'image' | 'video';

export function inferGalleryKind(
  mimeType: string | undefined,
  sourceName: string,
): GalleryKind {
  const mime = (mimeType ?? '').toLowerCase();
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  const lower = sourceName.toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov')) return 'video';
  return 'image';
}

export function normalizeGalleryTags(tags?: string[], category?: string): string[] {
  const normalized = (tags ?? [])
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .slice(0, 20);
  const unique = [...new Set(normalized)];
  if (unique.length > 0) return unique;
  const fallback = (category ?? '').trim();
  return fallback ? [fallback] : ['general'];
}
