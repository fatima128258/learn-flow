const ERROR_MESSAGES: Record<string, string> = {
  ORG_ADMIN_REQUIRED: 'You do not have permission to view this organization dashboard.',
  ORGANIZATION_ACCESS_DENIED: 'You do not have access to this organization.',
  ORGANIZATION_NOT_FOUND: 'Your organization no longer exists.',
  ORGANIZATION_REQUIRED: 'No organization context is available for your account.',
};

export function getOrgAdminErrorMessage(code?: unknown): string {
  if (typeof code === 'string' && code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[code];
  }
  return 'Could not load the organization dashboard. Please try again.';
}
