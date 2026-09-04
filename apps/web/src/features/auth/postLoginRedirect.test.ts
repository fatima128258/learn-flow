import { describe, expect, it } from 'vitest';
import { getPostLoginRedirect } from './postLoginRedirect';

describe('getPostLoginRedirect', () => {
  it('redirects platform admins to the dashboard', () => {
    expect(getPostLoginRedirect({ role: 'PLATFORM_ADMIN' })).toBe('/dashboard');
  });

  it('redirects organization admins to their organization dashboard', () => {
    expect(getPostLoginRedirect({ role: 'ORG_ADMIN', organizationId: 'org-123' })).toBe('/dashboard/organization');
  });

  it('redirects students to their course search page', () => {
    expect(getPostLoginRedirect({ role: 'STUDENT', organizationId: 'org-123' })).toBe('/dashboard/student/search');
  });

  it('redirects instructors to their instructor dashboard', () => {
    expect(getPostLoginRedirect({ role: 'INSTRUCTOR', organizationId: 'org-123' })).toBe('/dashboard/instructor');
  });

  it('redirects organization admins without organization to home page', () => {
    expect(getPostLoginRedirect({ role: 'ORG_ADMIN' })).toBe('/');
  });

  it('redirects all other users to the home page', () => {
    expect(getPostLoginRedirect({ role: null })).toBe('/');
    expect(getPostLoginRedirect()).toBe('/');
  });
});
