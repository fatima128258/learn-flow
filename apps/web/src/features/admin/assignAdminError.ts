const ERROR_MESSAGES: Record<string, string> = {
  MISSING_FIELDS: 'Email is required, and a password is required when creating a new user.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  PASSWORD_TOO_SHORT: 'Password must be at least 8 characters.',
  ROLE_NOT_ALLOWED: 'This role cannot be assigned.',
  ORGANIZATION_NOT_FOUND: 'This organization no longer exists.',
  USER_NOT_FOUND: 'No user was found for the provided details.',
  PLATFORM_ADMIN_REQUIRED: 'You do not have permission to assign organization admins.',
};

export function getAssignAdminErrorMessage(code?: unknown): string {
  if (typeof code === 'string' && code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[code];
  }
  return 'Could not assign the organization admin. Please try again.';
}
