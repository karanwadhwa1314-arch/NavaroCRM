export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parsePagination(searchParams: URLSearchParams, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const rawLimit = Number(searchParams.get('limit')) || defaultLimit;
  const limit = Math.min(maxLimit, Math.max(1, rawLimit));
  return { page, limit, skip: (page - 1) * limit };
}

/** Whitelists the requested sort field against `allowed`; falls back to `fallback` otherwise. */
export function parseSort<T extends string>(
  searchParams: URLSearchParams,
  allowed: readonly T[],
  fallback: T
): { field: T; order: 1 | -1 } {
  const requested = searchParams.get('sort');
  const field = (allowed as readonly string[]).includes(requested ?? '') ? (requested as T) : fallback;
  const order = searchParams.get('order') === 'asc' ? 1 : -1;
  return { field, order };
}
