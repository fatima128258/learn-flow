import { describe, expect, it } from 'vitest';
import { getPostLoginRedirect } from './postLoginRedirect';

describe('getPostLoginRedirect', () => {
  it('redirects platform admins to the dashboard', () => {
    expect(getPostLoginRedirect({ role: 'PLATFORM_ADMIN' })).toBe('/dashboard');
  });

  it('redirects organization admins to their organization dashboard', () => {
    expect(getPostLoginRedirect({ role: 'ORG_ADMIN' })).toBe('/dashboard/organization');
  });

  it('redirects students to their learning dashboard', () => {
    expect(getPostLoginRedirect({ role: 'STUDENT' })).toBe('/dashboard/student');
  });

  it('redirects instructors to their instructor dashboard', () => {
    expect(getPostLoginRedirect({ role: 'INSTRUCTOR' })).toBe('/dashboard/instructor');
  });

  it('redirects all other users to the home page', () => {
    expect(getPostLoginRedirect({ role: null })).toBe('/');
    expect(getPostLoginRedirect()).toBe('/');
  });
});
