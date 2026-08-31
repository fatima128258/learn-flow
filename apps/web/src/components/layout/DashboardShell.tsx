'use client';

import React, { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { DashboardLayout, type NavItem } from './DashboardLayout';
import { platformAdminNav } from '@/features/platformAdmin/nav';
import { orgAdminNav } from '@/features/organizationAdmin/nav';
import { instructorNav } from '@/features/instructor/nav';
import { studentNav } from '@/features/student/nav';
import { useCurrentUser } from '@/features/auth/useCurrentUser';

export interface DashboardShellProps {
  children: React.ReactNode;
}

/**
 * Picks the sidebar navigation (label + items) for the current dashboard route.
 * Selection is driven primarily by the pathname so the shell renders immediately
 * without waiting on any async role lookup (no navigation flash).
 */
function resolveNav(
  pathname: string,
  role: string | null | undefined,
): { navLabel: string; items: NavItem[] } {
  if (pathname.startsWith('/dashboard/instructor')) {
    return { navLabel: 'Instructor', items: instructorNav };
  }

  if (pathname.startsWith('/dashboard/student')) {
    return { navLabel: 'Student', items: studentNav };
  }

  if (pathname === '/dashboard/organization' || pathname.startsWith('/dashboard/organization/')) {
    const isCourseAuthoring = pathname.startsWith('/dashboard/organization/courses');
    if (isCourseAuthoring && role === 'INSTRUCTOR') {
      return { navLabel: 'Instructor', items: instructorNav };
    }
    return { navLabel: 'Organization Admin', items: orgAdminNav };
  }

  if (pathname === '/dashboard/profile' || pathname === '/dashboard/settings') {
    if (role === 'STUDENT') return { navLabel: 'Student', items: studentNav };
    if (role === 'INSTRUCTOR') return { navLabel: 'Instructor', items: instructorNav };
    if (role === 'ORG_ADMIN') return { navLabel: 'Organization Admin', items: orgAdminNav };
    return { navLabel: 'Platform Admin', items: platformAdminNav };
  }

  return { navLabel: 'Platform Admin', items: platformAdminNav };
}

export const DashboardShell: React.FC<DashboardShellProps> = ({ children }) => {
  const pathname = usePathname();
  const { data: currentUser } = useCurrentUser();

  const { navLabel, items } = useMemo(
    () => resolveNav(pathname ?? '/dashboard', currentUser?.role),
    [pathname, currentUser?.role],
  );

  return (
    <DashboardLayout navLabel={navLabel} items={items}>
      {children}
    </DashboardLayout>
  );
};

DashboardShell.displayName = 'DashboardShell';
