const ERROR_MESSAGES: Record<string, string> = {
  MISSING_FIELDS: 'Please check the highlighted fields and try again.',
  INVALID_ORDER: 'Order must be a non-negative integer.',
  INVALID_VALUE: 'Please enter a valid value for the highlighted field.',
  ORGANIZATION_REQUIRED: 'Your organization could not be determined. Please try again.',
  COURSE_NOT_FOUND: 'This course was not found in your organization.',
  MODULE_NOT_FOUND: 'This module was not found in the course.',
  QUIZ_NOT_FOUND: 'This quiz was not found in the module.',
  QUIZ_ORDER_TAKEN: 'A quiz with this order already exists in the module. Please choose another order.',
  QUESTION_NOT_FOUND: 'This question was not found in the quiz.',
  QUESTION_ORDER_TAKEN: 'A question with this order already exists in the quiz. Please choose another order.',
  OPTION_NOT_FOUND: 'This option was not found in the question.',
  OPTION_ORDER_TAKEN: 'An option with this order already exists in the question. Please choose another order.',
};

export function getQuizErrorMessage(code?: unknown): string {
  if (typeof code === 'string' && code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[code];
  }
  if (code === 'SERVER_ERROR') {
    return 'Something went wrong. Please try again.';
  }
  return 'Could not complete the action. Please try again.';
}
