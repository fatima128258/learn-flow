export function getPostLoginRedirect(user?: { role?: string | null } | null) {
  return user?.role === 'PLATFORM_ADMIN' ? '/dashboard' : '/';
}
