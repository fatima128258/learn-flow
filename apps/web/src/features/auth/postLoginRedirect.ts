export function getPostLoginRedirect(user?: { role?: string | null } | null) {
  if (user?.role === 'PLATFORM_ADMIN') return '/dashboard';
  if (user?.role === 'ORG_ADMIN') return '/dashboard/organization';
  if (user?.role === 'STUDENT') return '/dashboard/student';
  return '/';
}
