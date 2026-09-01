export function getPostLoginRedirect(user?: { role?: string | null; organizationId?: string | null } | null) {
  // Only redirect to role-specific dashboards if user has both role AND organization
  if (user?.role && user?.organizationId) {
    if (user.role === 'PLATFORM_ADMIN') return '/dashboard';
    if (user.role === 'ORG_ADMIN') return '/dashboard/organization';
    if (user.role === 'INSTRUCTOR') return '/dashboard/instructor';
    if (user.role === 'STUDENT') return '/dashboard/student/search';
  }
  // For new users without an assigned role/organization, send them to home page
  // They can browse public content while waiting for organization assignment
  return '/';
}
