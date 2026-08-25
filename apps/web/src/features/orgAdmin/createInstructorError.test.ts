import { describe, expect, it } from 'vitest';
import { getCreateInstructorErrorMessage } from './createInstructorError';

describe('getCreateInstructorErrorMessage', () => {
  it('maps known API error codes to user-friendly messages', () => {
    expect(getCreateInstructorErrorMessage('MISSING_FIELDS')).toBe('Email and password are required.');
    expect(getCreateInstructorErrorMessage('INVALID_EMAIL')).toBe('Please enter a valid email address.');
    expect(getCreateInstructorErrorMessage('PASSWORD_TOO_SHORT')).toBe(
      'Password must be at least 8 characters.'
    );
    expect(getCreateInstructorErrorMessage('ROLE_NOT_ALLOWED')).toBe(
      'Only instructors can be created from this page.'
    );
    expect(getCreateInstructorErrorMessage('USER_ALREADY_IN_ORGANIZATION')).toBe(
      'This user is already a member of your organization.'
    );
  });

  it('falls back to a generic message for unknown or missing error codes', () => {
    expect(getCreateInstructorErrorMessage('SERVER_ERROR')).toBe(
      'Could not create the instructor. Please try again.'
    );
    expect(getCreateInstructorErrorMessage(undefined)).toBe(
      'Could not create the instructor. Please try again.'
    );
    expect(getCreateInstructorErrorMessage(null)).toBe('Could not create the instructor. Please try again.');
  });
});
