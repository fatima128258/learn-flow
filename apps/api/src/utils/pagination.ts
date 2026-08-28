export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

function parsePositiveInt(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed > 0 ? Math.floor(parsed) : fallback;
}

export interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export function parsePagination(input: { page?: unknown; limit?: unknown } = {}): PaginationResult {
  const page = parsePositiveInt(input.page, DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, parsePositiveInt(input.limit, DEFAULT_LIMIT));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export function buildMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total };
}

export interface SortOption {
  field: string;
  defaultOrder?: 'asc' | 'desc';
}

export function parseSort(
  rawSort: unknown,
  rawOrder: unknown,
  allowed: SortOption[],
): Record<string, 'asc' | 'desc'> {
  const byField: Record<string, SortOption> = {};
  for (const option of allowed) byField[option.field] = option;
  const fallback = allowed[0];

  const field = typeof rawSort === 'string' && byField[rawSort] ? rawSort : fallback.field;
  const option = byField[field] ?? fallback;
  const order = rawOrder === 'asc' ? 'asc' : rawOrder === 'desc' ? 'desc' : (option.defaultOrder ?? 'desc');
  return { [field]: order };
}