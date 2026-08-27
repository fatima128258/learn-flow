const ERROR_MESSAGES: Record<string, string> = {
  ORGANIZATION_REQUIRED: 'Your organization could not be determined. Please try again.',
  ORGANIZATION_ACCESS_DENIED: 'You do not have access to this organization.',
  INSUFFICIENT_PERMISSIONS: 'You do not have permission to view courses.',
  EMAIL_NOT_VERIFIED: 'Please verify your email address before accessing courses.',
};

export function getListCoursesErrorMessage(code?: unknown): string {
  if (typeof code === 'string' && code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[code];
  }
  if (code === 'SERVER_ERROR') {
    return 'Something went wrong while loading courses. Please try again.';
  }
  return 'Could not load courses. Please try again.';
}