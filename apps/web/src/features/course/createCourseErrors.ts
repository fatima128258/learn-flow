const ERROR_MESSAGES: Record<string, string> = {
  MISSING_FIELDS: 'Please check the highlighted fields and try again.',
  TITLE_TOO_SHORT: 'Course title must be at least 2 characters long.',
  ORGANIZATION_REQUIRED: 'Your organization could not be determined. Please try again.',
  COURSE_NOT_FOUND: 'This course was not found in your organization.',
  INVALID_PRICE: 'Price must be a number greater than or equal to 0.',
  INVALID_DISCOUNT_PRICE: 'Discount price must be a number greater than or equal to 0.',
  FORBIDDEN: 'You do not have permission to modify this course.',
};

export function getCreateCourseErrorMessage(code?: unknown): string {
  if (typeof code === 'string' && code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[code];
  }
  if (code === 'SERVER_ERROR') {
    return 'Something went wrong while creating the course. Please try again.';
  }
  return 'Could not create the course. Please try again.';
}
