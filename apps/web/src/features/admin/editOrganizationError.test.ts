import { describe, expect, it } from 'vitest';
import { getEditOrganizationErrorMessage } from './editOrganizationError';

describe('getEditOrganizationErrorMessage', () => {
  it('maps known API error codes to user-friendly messages', () => {
    expect(getEditOrganizationErrorMessage('MISSING_FIELDS')).toBe('Organization name is required.');
    expect(getEditOrganizationErrorMessage('INVALID_SLUG')).toBe('Organization name must be at least 2 characters.');
    expect(getEditOrganizationErrorMessage('ORGANIZATION_SLUG_TAKEN')).toBe(
      'An organization with this name already exists.'
    );
    expect(getEditOrganizationErrorMessage('ORGANIZATION_NOT_FOUND')).toBe('This organization no longer exists.');
  });

  it('falls back to a generic message for unknown or missing error codes', () => {
    expect(getEditOrganizationErrorMessage('SERVER_ERROR')).toBe(
      'Could not update the organization. Please try again.'
    );
    expect(getEditOrganizationErrorMessage(undefined)).toBe(
      'Could not update the organization. Please try again.'
    );
    expect(getEditOrganizationErrorMessage(null)).toBe('Could not update the organization. Please try again.');
  });
});
