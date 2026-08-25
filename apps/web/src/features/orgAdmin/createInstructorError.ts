const ERROR_MESSAGES: Record<string, string> = {
  MISSING_FIELDS: 'Email and password are required.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  PASSWORD_TOO_SHORT: 'Password must be at least 8 characters.',
  ROLE_NOT_ALLOWED: 'Only instructors can be created from this page.',
  ORGANIZATION_ACCESS_DENIED: 'You do not have access to this organization.',
  USER_ALREADY_IN_ORGANIZATION: 'This user is already a member of your organization.',
  ORGANIZATION_NOT_FOUND: 'Your organization no longer exists.',
  USER_NOT_FOUND: 'User not found.',
};

export function getCreateInstructorErrorMessage(code?: unknown): string {
  if (typeof code === 'string' && code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[code];
  }
  return 'Could not create the instructor. Please try again.';
}
