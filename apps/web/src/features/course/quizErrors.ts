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
  INVALID_ANSWERS: 'One of your answers is invalid. Please check your selections and try again.',
  ALL_QUESTIONS_REQUIRED: 'Please answer every question before submitting.',
  QUIZ_HAS_NO_QUESTIONS: 'This quiz does not have any questions yet.',
  STUDENT_NOT_ENROLLED: 'You must be enrolled in this course to take the quiz.',
  MAX_ATTEMPTS_REACHED: 'You have used all of your allowed attempts for this quiz.',
  ATTEMPT_ALREADY_SUBMITTED: 'This attempt has already been submitted. Please refresh to see your result.',
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
