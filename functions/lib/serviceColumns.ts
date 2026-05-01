export const BASE_SERVICE_COLUMNS = 'id, slug, name, description, duration_minutes, price_cents, price_unit, active, sort_order, created_at, image_url, updated_at';
export const CATEGORY_SERVICE_COLUMNS = `${BASE_SERVICE_COLUMNS}, category`;

/** Prefix each column in a comma-separated list with a table alias (e.g. 's.'). */
export function prefixColumns(columns: string, alias: string): string {
  return columns
    .split(',')
    .map((c) => `${alias}.${c.trim()}`)
    .join(', ');
}
