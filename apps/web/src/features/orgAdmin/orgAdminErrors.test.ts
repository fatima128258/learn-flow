import { describe, expect, it } from 'vitest';
import { getOrgAdminErrorMessage } from './orgAdminErrors';

describe('getOrgAdminErrorMessage', () => {
  it('maps known API error codes to user-friendly messages', () => {
    expect(getOrgAdminErrorMessage('ORG_ADMIN_REQUIRED')).toBe(
      'You do not have permission to view this organization dashboard.'
    );
    expect(getOrgAdminErrorMessage('ORGANIZATION_ACCESS_DENIED')).toBe(
      'You do not have access to this organization.'
    );
    expect(getOrgAdminErrorMessage('ORGANIZATION_NOT_FOUND')).toBe('Your organization no longer exists.');
    expect(getOrgAdminErrorMessage('ORGANIZATION_REQUIRED')).toBe(
      'No organization context is available for your account.'
    );
  });

  it('falls back to a generic message for unknown or missing error codes', () => {
    expect(getOrgAdminErrorMessage('SERVER_ERROR')).toBe(
      'Could not load the organization dashboard. Please try again.'
    );
    expect(getOrgAdminErrorMessage(undefined)).toBe(
      'Could not load the organization dashboard. Please try again.'
    );
    expect(getOrgAdminErrorMessage(null)).toBe('Could not load the organization dashboard. Please try again.');
  });
});
