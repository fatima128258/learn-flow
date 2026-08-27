const ERROR_MESSAGES: Record<string, string> = {
  MISSING_FIELDS: 'Please check the highlighted fields and try again.',
  INVALID_ORDER: 'Order must be a non-negative integer.',
  INVALID_DURATION: 'Duration must be a non-negative integer.',
  ORGANIZATION_REQUIRED: 'Your organization could not be determined. Please try again.',
  COURSE_NOT_FOUND: 'This course was not found in your organization.',
  MODULE_NOT_FOUND: 'This module was not found in the course.',
  LESSON_NOT_FOUND: 'This lesson was not found in the module.',
  LESSON_ORDER_TAKEN: 'A lesson with this order already exists in the module. Please choose another order.',
};

export function getLessonErrorMessage(code?: unknown): string {
  if (typeof code === 'string' && code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[code];
  }
  if (code === 'SERVER_ERROR') {
    return 'Something went wrong. Please try again.';
  }
  return 'Could not complete the action. Please try again.';
}
