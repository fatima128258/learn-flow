const ERROR_MESSAGES: Record<string, string> = {
  ORGANIZATION_NOT_FOUND: 'This organization no longer exists.',
  INVALID_STATUS: 'Invalid organization status.',
  PLATFORM_ADMIN_REQUIRED: 'You do not have permission to change organization status.',
};

export function getOrganizationStatusErrorMessage(code?: unknown): string {
  if (typeof code === 'string' && code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[code];
  }
  return 'Could not update the organization status. Please try again.';
}
