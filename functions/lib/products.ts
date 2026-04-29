export function slugifyProduct(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function normalizeProductTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().replace(/\s+/g, ' ');
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(tag);
  }
  return normalized;
}

export function parseProductTagsJson(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeProductTags(parsed.filter((item): item is string => typeof item === 'string'));
  } catch {
    return [];
  }
}

export async function ensureUniqueProductSlug(
  db: D1Database,
  desiredSlug: string,
  excludeProductId?: number,
): Promise<string> {
  const base = slugifyProduct(desiredSlug) || 'product';
  let candidate = base;
  let attempt = 2;
  const MAX_SLUG_COLLISION_ATTEMPTS = 100;

  while (attempt <= MAX_SLUG_COLLISION_ATTEMPTS) {
    const existing = await db.prepare('SELECT id FROM products WHERE slug = ?').bind(candidate).first<{ id: number }>();
    if (!existing || (excludeProductId !== undefined && Number(existing.id) === excludeProductId)) {
      return candidate;
    }
    candidate = `${base}-${attempt}`;
    attempt += 1;
  }

  throw new Error('Unable to generate a unique product slug');
}
