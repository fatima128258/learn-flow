export function categoryLabel(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const name = (value as Record<string, unknown>)?.name;
    return typeof name === 'string' ? name : null;
  }
  return null;
}