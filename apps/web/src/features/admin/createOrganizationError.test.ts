import { describe, expect, it } from 'vitest';
import { getCreateOrganizationErrorMessage } from './createOrganizationError';

describe('getCreateOrganizationErrorMessage', () => {
  it('maps known API error codes to user-friendly messages', () => {
    expect(getCreateOrganizationErrorMessage('MISSING_FIELDS')).toBe('Organization name is required.');
    expect(getCreateOrganizationErrorMessage('INVALID_SLUG')).toBe('Organization name must be at least 2 characters.');
    expect(getCreateOrganizationErrorMessage('ORGANIZATION_SLUG_TAKEN')).toBe(
      'An organization with this name already exists.'
    );
  });

  it('falls back to a generic message for unknown or missing error codes', () => {
    expect(getCreateOrganizationErrorMessage('SERVER_ERROR')).toBe(
      'Could not create the organization. Please try again.'
    );
    expect(getCreateOrganizationErrorMessage(undefined)).toBe(
      'Could not create the organization. Please try again.'
    );
    expect(getCreateOrganizationErrorMessage(null)).toBe('Could not create the organization. Please try again.');
  });
});
