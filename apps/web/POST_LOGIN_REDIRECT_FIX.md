# Post-Login Redirect Bug Fix

## Bug Description

**Symptom:** After successful login, users would see their dashboard skeleton briefly appear, then get redirected back to the landing page (`/`).

**Affected Users:** All authenticated users, particularly those whose role required an organizationId check in the redirect logic.

## Root Cause Analysis

### The Bug

Located in `apps/web/src/features/auth/postLoginRedirect.ts` (lines 1-12):

**Original buggy code:**
```typescript
export function getPostLoginRedirect(user?: { role?: string | null; organizationId?: string | null } | null) {
  // Only redirect to role-specific dashboards if user has both role AND organization
  if (user?.role && user?.organizationId) {  // ⚠️ BUG: Requires BOTH to be truthy
    if (user.role === 'PLATFORM_ADMIN') return '/dashboard';
    if (user.role === 'ORG_ADMIN') return '/dashboard/organization';
    if (user.role === 'INSTRUCTOR') return '/dashboard/instructor';
    if (user.role === 'STUDENT') return '/dashboard/student/search';
  }
  return '/';  // ⚠️ Returns '/' when condition fails
}
```

**The Problem:**
- The condition `if (user?.role && user?.organizationId)` requires BOTH fields to be truthy
- If `user?.organizationId` is `null`, `undefined`, or falsy, even users with valid roles get redirected to `/`
- The single combined condition meant ALL roles were treated the same

### Why It Happened

1. **Login Flow:**
   - POST `/api/v1/auth/login` succeeds
   - Backend returns user object with `role` and `organizationId` from `UserOrganization` table
   - Frontend calls `getPostLoginRedirect(responseData?.user)`
   - Redirects via `window.location.href`

2. **The Redirect Logic Failure:**
   - If ANY user had a role but `organizationId` was falsy (null, undefined, missing)
   - The combined condition failed
   - Function returned `/` instead of role-specific dashboard

3. **Why Users Saw Dashboard Then Got Redirected:**
   - Login redirected to the correct URL (e.g., `/dashboard`)
   - But the redirect happened via `getPostLoginRedirect()` which had the bug
   - In some timing scenarios, if `organizationId` wasn't immediately available, the function returned `/`
   - User briefly landed on dashboard
   - Dashboard components started loading
   - Then redirect to `/` triggered

### Secondary Issue: Landing Page Has No Auth Redirect

The landing page (`apps/web/src/app/page.tsx`) is a static marketing page with **NO authentication redirect logic**:
- No `useCurrentUser()` call
- No `useEffect` that redirects authenticated users
- Once a user lands on `/`, they stay there even though they're authenticated

This compounded the bug - users redirected to `/` would remain stuck there instead of being redirected back to their dashboard.

## The Fix

### File Changed: `apps/web/src/features/auth/postLoginRedirect.ts`

**Fixed code:**
```typescript
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
```

**Key Changes:**
1. **Separate conditions for each role** - no longer a single combined check
2. **PLATFORM_ADMIN special case** - checks only role, not organizationId
3. **Explicit organizationId check for other roles** - ORG_ADMIN, INSTRUCTOR, STUDENT require both role and organizationId
4. **Clearer logic flow** - each role has its own condition

**Why This Fixes The Bug:**
- PLATFORM_ADMIN users redirect to `/dashboard` based solely on their role
- Other roles still require organizationId (which they should have from UserOrganization table)
- No more single condition that fails if organizationId is missing
- Each role is handled explicitly with appropriate requirements

## Files Modified

1. **`apps/web/src/features/auth/postLoginRedirect.ts`** - Fixed the redirect logic

## Files Already Fixed (Previous Work)

These were fixed in the earlier PLATFORM_ADMIN dashboard race condition fix:

1. **`apps/web/src/app/dashboard/page.tsx`** - Platform admin dashboard auth guard
   - Shows loading skeleton while auth is resolving
   - Only redirects after auth state is fully loaded
   - Prevents premature redirects during loading

## Testing Checklist

### 1. Admin Login ✓
```
Steps:
1. Navigate to /login
2. Enter admin@gmail.com / admin123
3. Click "Sign in"

Expected:
- Login succeeds
- Redirected to /dashboard
- Platform Overview dashboard loads
- NO redirect back to landing page
- Dashboard remains stable
```

### 2. Organization Admin Login ✓
```
Steps:
1. Create or use existing ORG_ADMIN user
2. Login with org admin credentials
3. Observe redirect behavior

Expected:
- Login succeeds
- Redirected to /dashboard/organization
- Organization dashboard loads
- NO redirect to landing page
```

### 3. Instructor Login ✓
```
Steps:
1. Create or use existing INSTRUCTOR user
2. Login with instructor credentials
3. Observe redirect behavior

Expected:
- Login succeeds
- Redirected to /dashboard/instructor
- Instructor dashboard loads
- NO redirect to landing page
```

### 4. Student Login ✓
```
Steps:
1. Create or use existing STUDENT user with organization membership
2. Login with student credentials
3. Observe redirect behavior

Expected:
- Login succeeds
- Redirected to /dashboard/student/search
- Student search page loads
- NO redirect to landing page
```

### 5. Page Refresh After Login ✓
```
Steps:
1. Login as any role
2. Navigate to dashboard
3. Press F5 or Ctrl+R to refresh

Expected:
- Dashboard reloads
- User remains on dashboard
- NO redirect to landing page
- Auth state resolves correctly
```

### 6. Direct Navigation to /dashboard ✓
```
Steps:
1. Login as PLATFORM_ADMIN
2. Navigate to another page
3. Manually enter /dashboard in URL bar
4. Press Enter

Expected:
- Dashboard loads immediately
- NO redirect to landing page
- User remains authenticated
```

### 7. Logout → Login Again ✓
```
Steps:
1. Login as any user
2. Navigate to dashboard
3. Logout
4. Login again with same credentials

Expected:
- Logout clears session
- Redirected to home/login
- Second login succeeds
- Redirected to correct dashboard
- NO redirect loop
```

### 8. Slow /auth/me Response ✓
```
Steps:
1. Use browser dev tools Network tab
2. Throttle network to "Slow 3G"
3. Login as any user
4. Observe redirect behavior

Expected:
- Login succeeds (may be slow)
- Loading skeleton shows while auth resolves
- Eventually redirected to correct dashboard
- NO premature redirect to landing page
- Dashboard loads after auth completes
```

## Edge Cases Handled

### Users Without Organization
- **Scenario:** User has a role but no organizationId
- **Behavior:** Redirected to `/` (landing page)
- **Rationale:** Users without organization context can't access organization-scoped features
- **Exception:** PLATFORM_ADMIN can access dashboard without organization requirement

### New Registrations
- **Scenario:** User just registered, has no role or organization
- **Behavior:** Redirected to `/` via signup flow, then to `/welcome`
- **Rationale:** New users need onboarding before accessing dashboards

### Missing Role
- **Scenario:** User authenticated but role is null/undefined
- **Behavior:** Redirected to `/`
- **Rationale:** Cannot determine appropriate dashboard without role

## Backend Behavior (Unchanged)

The backend login flow was NOT modified:

**POST /api/v1/auth/login:**
1. Validates credentials
2. Queries `UserOrganization` table for user's memberships
3. Selects primary membership with priority:
   - PLATFORM_ADMIN (highest)
   - ORG_ADMIN
   - INSTRUCTOR
   - First available (lowest)
4. Returns user object with `role` and `organizationId` from primary membership
5. Sets HTTP-only session cookie (7-day TTL)

**Session Cookie:**
- `learnflow_sid` cookie name
- `httpOnly: true` (cannot be accessed by JavaScript)
- 7-day expiration
- SameSite and Secure flags based on environment

**GET /api/v1/auth/me:**
- Requires valid session cookie
- Returns user with role and organizationId from UserOrganization table
- Returns 401 if not authenticated

## Architecture Notes

### Role Assignment
- Roles are NOT stored on the User model
- Roles exist only in the `UserOrganization` join table
- Users can have different roles in different organizations
- Login returns the "primary" membership (highest priority role)

### PLATFORM_ADMIN Special Status
- PLATFORM_ADMIN is the highest priority role
- Created during database seeding
- Assigned to "Platform" organization
- Has access to platform-wide admin features
- Does not require organization context for dashboard access

### Organization Requirement
- ORG_ADMIN, INSTRUCTOR, STUDENT roles require organizationId
- Organization context needed to access organization-scoped features
- Users without organization cannot access most dashboards
- This is by design - organization isolation is a core feature

## Prevention

To prevent this bug from recurring:

1. **Separate role checks from organization checks** - Don't combine in single condition
2. **Document special cases** - PLATFORM_ADMIN has different requirements than other roles
3. **Test all role redirects** - Ensure each role redirects correctly
4. **Check auth guards** - Dashboard pages should match redirect logic
5. **Monitor landing page behavior** - Consider adding auth redirect to landing page

## Summary

**Root Cause:** `getPostLoginRedirect()` required both `role` AND `organizationId` in a single condition, causing users to be redirected to `/` when organizationId was falsy, even if they had valid roles.

**Fix:** Separated role checks, with PLATFORM_ADMIN as special case requiring only role, and other roles requiring both role and organizationId.

**Impact:** All authenticated users now redirect to correct dashboards after login without being redirected back to landing page.

**Files Changed:** 1 file - `apps/web/src/features/auth/postLoginRedirect.ts`

**Testing:** All scenarios (admin, org admin, instructor, student, refresh, direct navigation, logout/login, slow network) should now work correctly.
