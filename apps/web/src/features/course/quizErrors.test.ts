import { describe, expect, it } from 'vitest';
import { getQuizErrorMessage } from './quizErrors';

describe('getQuizErrorMessage', () => {
  it('maps known quiz management error codes to user-friendly messages', () => {
    expect(getQuizErrorMessage('MISSING_FIELDS')).toBe(
      'Please check the highlighted fields and try again.'
    );
    expect(getQuizErrorMessage('ORGANIZATION_REQUIRED')).toBe(
      'Your organization could not be determined. Please try again.'
    );
    expect(getQuizErrorMessage('COURSE_NOT_FOUND')).toBe(
      'This course was not found in your organization.'
    );
    expect(getQuizErrorMessage('MODULE_NOT_FOUND')).toBe(
      'This module was not found in the course.'
    );
    expect(getQuizErrorMessage('QUIZ_NOT_FOUND')).toBe(
      'This quiz was not found in the module.'
    );
    expect(getQuizErrorMessage('QUIZ_ORDER_TAKEN')).toBe(
      'A quiz with this order already exists in the module. Please choose another order.'
    );
    expect(getQuizErrorMessage('QUESTION_NOT_FOUND')).toBe(
      'This question was not found in the quiz.'
    );
    expect(getQuizErrorMessage('QUESTION_ORDER_TAKEN')).toBe(
      'A question with this order already exists in the quiz. Please choose another order.'
    );
    expect(getQuizErrorMessage('OPTION_NOT_FOUND')).toBe(
      'This option was not found in the question.'
    );
    expect(getQuizErrorMessage('OPTION_ORDER_TAKEN')).toBe(
      'An option with this order already exists in the question. Please choose another order.'
    );
  });

  it('maps quiz-taking error codes to user-friendly messages', () => {
    expect(getQuizErrorMessage('INVALID_ANSWERS')).toBe(
      'One of your answers is invalid. Please check your selections and try again.'
    );
    expect(getQuizErrorMessage('ALL_QUESTIONS_REQUIRED')).toBe(
      'Please answer every question before submitting.'
    );
    expect(getQuizErrorMessage('QUIZ_HAS_NO_QUESTIONS')).toBe(
      'This quiz does not have any questions yet.'
    );
    expect(getQuizErrorMessage('STUDENT_NOT_ENROLLED')).toBe(
      'You must be enrolled in this course to take the quiz.'
    );
    expect(getQuizErrorMessage('MAX_ATTEMPTS_REACHED')).toBe(
      'You have used all of your allowed attempts for this quiz.'
    );
    expect(getQuizErrorMessage('ATTEMPT_ALREADY_SUBMITTED')).toBe(
      'This attempt has already been submitted. Please refresh to see your result.'
    );
  });

  it('falls back to a generic message for SERVER_ERROR', () => {
    expect(getQuizErrorMessage('SERVER_ERROR')).toBe(
      'Something went wrong. Please try again.'
    );
  });

  it('falls back to a generic message for unknown or missing error codes', () => {
    expect(getQuizErrorMessage('SOMETHING_ELSE')).toBe(
      'Could not complete the action. Please try again.'
    );
    expect(getQuizErrorMessage(undefined)).toBe(
      'Could not complete the action. Please try again.'
    );
    expect(getQuizErrorMessage(null)).toBe(
      'Could not complete the action. Please try again.'
    );
  });
});
