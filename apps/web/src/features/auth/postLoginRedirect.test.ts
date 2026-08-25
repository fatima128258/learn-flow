import { describe, expect, it } from 'vitest';
import { getPostLoginRedirect } from './postLoginRedirect';

describe('getPostLoginRedirect', () => {
  it('redirects platform admins to the dashboard', () => {
    expect(getPostLoginRedirect({ role: 'PLATFORM_ADMIN' })).toBe('/dashboard');
  });

  it('redirects organization admins to their organization dashboard', () => {
    expect(getPostLoginRedirect({ role: 'ORG_ADMIN' })).toBe('/dashboard/organization');
  });

  it('redirects all other users to the home page', () => {
    expect(getPostLoginRedirect({ role: 'STUDENT' })).toBe('/');
    expect(getPostLoginRedirect({ role: 'INSTRUCTOR' })).toBe('/');
    expect(getPostLoginRedirect({ role: null })).toBe('/');
    expect(getPostLoginRedirect()).toBe('/');
  });
});
