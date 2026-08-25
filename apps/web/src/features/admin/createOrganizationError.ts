const ERROR_MESSAGES: Record<string, string> = {
  MISSING_FIELDS: 'Organization name is required.',
  INVALID_SLUG: 'Organization name must be at least 2 characters.',
  ORGANIZATION_SLUG_TAKEN: 'An organization with this name already exists.',
};

export function getCreateOrganizationErrorMessage(code?: unknown): string {
  if (typeof code === 'string' && code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[code];
  }
  return 'Could not create the organization. Please try again.';
}
