export function getPostLoginRedirect(user?: { role?: string | null; organizationId?: string | null } | null) {
  // Redirect based on role - PLATFORM_ADMIN doesn't require organizationId check
  if (user?.role === 'PLATFORM_ADMIN') return '/dashboard';
  
  // Other roles require organizationId to be present
  if (user?.role === 'ORG_ADMIN' && user?.organizationId) return '/dashboard/organization';
  if (user?.role === 'INSTRUCTOR' && user?.organizationId) return '/dashboard/instructor';
  if (user?.role === 'STUDENT' && user?.organizationId) return '/dashboard/student/search';
  
  // For users without an assigned role/organization, send them to home page
  // They can browse public content while waiting for organization assignment
  return '/';
}
