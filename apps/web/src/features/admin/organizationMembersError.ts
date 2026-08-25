const ERROR_MESSAGES: Record<string, string> = {
  ORGANIZATION_NOT_FOUND: 'This organization no longer exists.',
  PLATFORM_ADMIN_REQUIRED: 'You do not have permission to view organization members.',
};

export function getOrganizationMembersErrorMessage(code?: unknown): string {
  if (typeof code === 'string' && code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[code];
  }
  return 'Could not load organization members. Please try again.';
}
