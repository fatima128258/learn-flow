import { describe, expect, it } from 'vitest';
import { getCreateCourseErrorMessage } from './createCourseErrors';

describe('getCreateCourseErrorMessage', () => {
  it('maps known API error codes to user-friendly messages', () => {
    expect(getCreateCourseErrorMessage('MISSING_FIELDS')).toBe(
      'Please check the highlighted fields and try again.'
    );
    expect(getCreateCourseErrorMessage('ORGANIZATION_REQUIRED')).toBe(
      'Your organization could not be determined. Please try again.'
    );
    expect(getCreateCourseErrorMessage('COURSE_NOT_FOUND')).toBe(
      'This course was not found in your organization.'
    );
  });

  it('falls back to a generic message for unknown or missing error codes', () => {
    expect(getCreateCourseErrorMessage('SERVER_ERROR')).toBe(
      'Something went wrong while creating the course. Please try again.'
    );
    expect(getCreateCourseErrorMessage('SOMETHING_ELSE')).toBe(
      'Could not create the course. Please try again.'
    );
    expect(getCreateCourseErrorMessage(undefined)).toBe(
      'Could not create the course. Please try again.'
    );
    expect(getCreateCourseErrorMessage(null)).toBe('Could not create the course. Please try again.');
  });
});
