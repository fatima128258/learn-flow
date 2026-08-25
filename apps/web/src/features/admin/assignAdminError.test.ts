import { describe, expect, it } from 'vitest';
import { getAssignAdminErrorMessage } from './assignAdminError';

describe('getAssignAdminErrorMessage', () => {
  it('maps known API error codes to user-friendly messages', () => {
    expect(getAssignAdminErrorMessage('MISSING_FIELDS')).toBe(
      'Email is required, and a password is required when creating a new user.'
    );
    expect(getAssignAdminErrorMessage('INVALID_EMAIL')).toBe('Please enter a valid email address.');
    expect(getAssignAdminErrorMessage('PASSWORD_TOO_SHORT')).toBe('Password must be at least 8 characters.');
    expect(getAssignAdminErrorMessage('ROLE_NOT_ALLOWED')).toBe('This role cannot be assigned.');
    expect(getAssignAdminErrorMessage('ORGANIZATION_NOT_FOUND')).toBe('This organization no longer exists.');
    expect(getAssignAdminErrorMessage('USER_NOT_FOUND')).toBe('No user was found for the provided details.');
    expect(getAssignAdminErrorMessage('PLATFORM_ADMIN_REQUIRED')).toBe(
      'You do not have permission to assign organization admins.'
    );
  });

  it('falls back to a generic message for unknown or missing error codes', () => {
    expect(getAssignAdminErrorMessage('SERVER_ERROR')).toBe(
      'Could not assign the organization admin. Please try again.'
    );
    expect(getAssignAdminErrorMessage(undefined)).toBe('Could not assign the organization admin. Please try again.');
    expect(getAssignAdminErrorMessage(null)).toBe('Could not assign the organization admin. Please try again.');
  });
});
