import { describe, expect, it } from 'vitest';
import { getOrganizationMembersErrorMessage } from './organizationMembersError';

describe('getOrganizationMembersErrorMessage', () => {
  it('maps known API error codes to user-friendly messages', () => {
    expect(getOrganizationMembersErrorMessage('ORGANIZATION_NOT_FOUND')).toBe('This organization no longer exists.');
    expect(getOrganizationMembersErrorMessage('PLATFORM_ADMIN_REQUIRED')).toBe(
      'You do not have permission to view organization members.'
    );
  });

  it('falls back to a generic message for unknown or missing error codes', () => {
    expect(getOrganizationMembersErrorMessage('SERVER_ERROR')).toBe(
      'Could not load organization members. Please try again.'
    );
    expect(getOrganizationMembersErrorMessage(undefined)).toBe(
      'Could not load organization members. Please try again.'
    );
    expect(getOrganizationMembersErrorMessage(null)).toBe(
      'Could not load organization members. Please try again.'
    );
  });
});
