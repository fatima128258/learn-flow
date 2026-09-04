export function getPostLoginRedirect(user?: { role?: string | null; organizationId?: string | null } | null) {
  // Log for debugging (in development only)
  if (process.env.NODE_ENV === 'development') {
    console.debug('[getPostLoginRedirect] User:', user);
  }
  
  // Handle null/undefined user
  if (!user) {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[getPostLoginRedirect] No user object provided, redirecting to home');
    }
    return '/';
  }
  
  // Redirect based on role - PLATFORM_ADMIN doesn't require organizationId check
  if (user?.role === 'PLATFORM_ADMIN') {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[getPostLoginRedirect] PLATFORM_ADMIN -> /dashboard');
    }
    return '/dashboard';
  }
  
  // ORG_ADMIN requires organizationId
  if (user?.role === 'ORG_ADMIN') {
    if (user?.organizationId) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[getPostLoginRedirect] ORG_ADMIN with organization -> /dashboard/organization');
      }
      return '/dashboard/organization';
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[getPostLoginRedirect] ORG_ADMIN without organization -> / (needs organization assignment)');
      }
      return '/';
    }
  }
  
  // INSTRUCTOR requires organizationId
  if (user?.role === 'INSTRUCTOR' && user?.organizationId) {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[getPostLoginRedirect] INSTRUCTOR -> /dashboard/instructor');
    }
    return '/dashboard/instructor';
  }
  
  // STUDENT requires organizationId and goes to search page
  if (user?.role === 'STUDENT' && user?.organizationId) {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[getPostLoginRedirect] STUDENT -> /dashboard/student/search');
    }
    return '/dashboard/student/search';
  }
  
  // For users without an assigned role/organization, send them to home page
  // They can browse public content while waiting for organization assignment
  if (process.env.NODE_ENV === 'development') {
    console.debug('[getPostLoginRedirect] Default fallback -> /');
  }
  return '/';
}
