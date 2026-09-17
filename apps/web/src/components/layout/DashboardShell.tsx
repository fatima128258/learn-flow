'use client';

import React, { Suspense, useEffect, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { DashboardLayout, type NavItem } from './DashboardLayout';
import { platformAdminNav } from '@/features/platformAdmin/nav';
import { orgAdminNav } from '@/features/organizationAdmin/nav';
import { instructorNav } from '@/features/instructor/nav';
import { studentNav } from '@/features/student/nav';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { useChatUnread } from '@/features/chat/useChatUnread';

export interface DashboardShellProps {
  children: React.ReactNode;
}

function withOrgContext(items: NavItem[], orgId: string | null): NavItem[] {
  if (!orgId) return items;
  return items.map((item) => {
    if (item.href.startsWith('/dashboard/organization/') || item.href === '/dashboard/organization') {
      const separator = item.href.includes('?') ? '&' : '?';
      return { ...item, href: `${item.href}${separator}organization=${orgId}` };
    }
    return item;
  });
}

function resolveNav(
  pathname: string,
  role: string | null | undefined,
  orgId: string | null,
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
      return { navLabel: 'Instructor', items: withOrgContext(instructorNav, orgId) };
    }
    return { navLabel: 'Organization Admin', items: withOrgContext(orgAdminNav, orgId) };
  }

  if (pathname === '/dashboard/profile' || pathname === '/dashboard/settings') {
    if (role === 'STUDENT') return { navLabel: 'Student', items: studentNav };
    if (role === 'INSTRUCTOR') return { navLabel: 'Instructor', items: instructorNav };
    if (role === 'ORG_ADMIN') return { navLabel: 'Organization Admin', items: orgAdminNav };
    return { navLabel: 'Platform Admin', items: platformAdminNav };
  }

  return { navLabel: 'Platform Admin', items: platformAdminNav };
}

function DashboardShellInner({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orgId = searchParams.get('organization');
  const { data: currentUser } = useCurrentUser();
  const unreadChatCount = useChatUnread(currentUser?.organizationId ?? undefined, currentUser?.id);

  useEffect(() => {
    if (!currentUser) return;
    const loginStartedAt = sessionStorage.getItem('learnflow:last-login-success-at');
    if (!loginStartedAt) return;
    const requestId = sessionStorage.getItem('learnflow:last-login-request-id') || 'frontend-auth-flow';
    const durationMs = Number((performance.now() - Number(loginStartedAt)).toFixed(2));
    console.log(`[AUTH_PERF] request=${requestId} stage=dashboard_auth_render durationMs=${durationMs}`);
    sessionStorage.removeItem('learnflow:last-login-success-at');
    sessionStorage.removeItem('learnflow:last-login-request-id');
  }, [currentUser]);

  const { navLabel, items: baseItems } = useMemo(
    () => resolveNav(pathname ?? '/dashboard', currentUser?.role, orgId),
    [pathname, currentUser?.role, orgId],
  );
  const items = useMemo(
    () => baseItems.map((item) => item.label === 'Chat' ? { ...item, badge: unreadChatCount } : item),
    [baseItems, unreadChatCount],
  );

  return (
    <DashboardLayout navLabel={navLabel} items={items}>
      {children}
    </DashboardLayout>
  );
}

export const DashboardShell: React.FC<DashboardShellProps> = ({ children }) => {
  return (
    <Suspense>
      <DashboardShellInner>{children}</DashboardShellInner>
    </Suspense>
  );
};

DashboardShell.displayName = 'DashboardShell';
