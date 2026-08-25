import { describe, expect, it } from 'vitest';
import { getOrganizationStatusErrorMessage } from './organizationStatusError';

describe('getOrganizationStatusErrorMessage', () => {
  it('maps known API error codes to user-friendly messages', () => {
    expect(getOrganizationStatusErrorMessage('ORGANIZATION_NOT_FOUND')).toBe('This organization no longer exists.');
    expect(getOrganizationStatusErrorMessage('INVALID_STATUS')).toBe('Invalid organization status.');
    expect(getOrganizationStatusErrorMessage('PLATFORM_ADMIN_REQUIRED')).toBe(
      'You do not have permission to change organization status.'
    );
  });

  it('falls back to a generic message for unknown or missing error codes', () => {
    expect(getOrganizationStatusErrorMessage('SERVER_ERROR')).toBe(
      'Could not update the organization status. Please try again.'
    );
    expect(getOrganizationStatusErrorMessage(undefined)).toBe(
      'Could not update the organization status. Please try again.'
    );
    expect(getOrganizationStatusErrorMessage(null)).toBe(
      'Could not update the organization status. Please try again.'
    );
  });
});
