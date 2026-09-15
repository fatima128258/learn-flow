const ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: 'You must be logged in to change course status.',
  EMAIL_NOT_VERIFIED: 'Please verify your email address before changing course status.',
  ORGANIZATION_REQUIRED: 'Your organization could not be determined. Please try again.',
  ORGANIZATION_ACCESS_DENIED: 'You do not have access to this organization.',
  INSUFFICIENT_PERMISSIONS: 'You do not have permission to change course status.',
  COURSE_NOT_FOUND: 'This course was not found in your organization.',
  INVALID_STATUS: 'The selected status is not valid.',
  MISSING_FIELDS: 'Status is required.',
  BACKEND_TIMEOUT: 'The server is waking up and did not respond in time. Please refresh the page before trying again; the status may already have been updated.',
  BACKEND_UNAVAILABLE: 'The course service is temporarily unavailable. Please try again shortly.',
  PROXY_ERROR: 'The course service is temporarily unavailable. Please try again shortly.',
};

export function getCourseStatusErrorMessage(code?: unknown): string {
  if (typeof code === 'string' && code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[code];
  }
  return 'Could not update course status. Please try again.';
}
