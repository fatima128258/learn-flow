export const ORGANIZATION_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isValidSlug(slug: string) {
  if (typeof slug !== 'string') return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function slugify(name: string) {
  if (typeof name !== 'string') return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isOrganizationStatus(value: unknown): value is OrganizationStatus {
  return typeof value === 'string' && ORGANIZATION_STATUSES.includes(value as OrganizationStatus);
}
