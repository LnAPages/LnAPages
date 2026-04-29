import { WEDDING_SERVICE_SLUGS } from '../../shared/constants';

type ServiceLikeRow = {
  slug?: unknown;
  category?: unknown;
};

const WEDDING_SERVICE_SLUGS_SET = new Set<string>(WEDDING_SERVICE_SLUGS);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isMissingCategoryColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no such column:\s*category/i.test(message);
}

export function isMissingColumnError(error: unknown, column: string): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return new RegExp(`no such column:\\s*${escapeRegex(column)}\\b`, 'i').test(message);
}

export function isMissingTableError(error: unknown, table: string): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return new RegExp(`no such table:\\s*${escapeRegex(table)}\\b`, 'i').test(message);
}

export function deriveServiceCategoryFromSlug(slug: unknown): string | null {
  const normalized = typeof slug === 'string' ? slug.trim() : '';
  if (!normalized) return null;
  // Keep this intentionally narrow for now: only migrated wedding slugs require a guaranteed category backfill.
  // The PR requirement explicitly migrates wedding rows to "photography"; do not broaden without a new migration plan.
  if (WEDDING_SERVICE_SLUGS_SET.has(normalized)) return 'photography';
  return null;
}

export function withDerivedServiceCategory<T extends ServiceLikeRow>(rows: T[]): Array<T & { category: string | null }> {
  return rows.map((row) => {
    const trimmedCategory = typeof row.category === 'string' ? row.category.trim() : '';
    const existingCategory = trimmedCategory.length > 0 ? trimmedCategory : null;
    return {
      ...row,
      category: existingCategory ?? deriveServiceCategoryFromSlug(row.slug),
    };
  });
}
