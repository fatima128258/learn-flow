'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { LinkButton } from '../../components/ui/LinkButton';
import { platformAdminNav } from '../../features/platformAdmin/nav';
import { useCurrentUser } from '../../features/auth/useCurrentUser';
import { getJson } from '../../lib/api';
import { CardSkeleton, ErrorState } from '../../components/ui';

type DashboardSummary = {
  organizations: { total: number; active: number; suspended: number };
  users: { total: number };
  organizationAdmins: { total: number };
};

export default function DashboardPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const {
    data: summary,
    isLoading: summaryLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const body = await getJson<{ data?: DashboardSummary }>('/api/v1/admin/dashboard');
      return body.data ?? null;
    },
    enabled: user?.role === 'PLATFORM_ADMIN',
  });

  useEffect(() => {
    if (userLoading) return;
    if (!user || user.role !== 'PLATFORM_ADMIN') {
      const target =
        user?.role === 'ORG_ADMIN'
          ? '/dashboard/organization'
          : user?.role === 'INSTRUCTOR'
            ? '/dashboard/instructor'
            : user?.role === 'STUDENT'
              ? '/dashboard/student'
              : '/';
      window.location.href = target;
    }
  }, [user, userLoading]);

  const busy = userLoading || summaryLoading;

  return (
    <DashboardLayout navLabel="Platform Admin" items={platformAdminNav}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Platform Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-neutral-900">Dashboard</h1>
          {user && (
            <div className="mt-4 space-y-1 text-neutral-700">
              <p><span className="font-semibold">Name:</span> {user.name ?? 'Platform Admin'}</p>
              <p><span className="font-semibold">Email:</span> {user.email}</p>
            </div>
          )}
          <div className="mt-6">
            <LinkButton href="/dashboard/organizations" variant="outline">
              Manage Organizations
            </LinkButton>
          </div>
        </div>

        {busy ? (
          <div className="grid gap-6 md:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : error || !summary ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState
              title="Unable to load dashboard"
              message="The platform dashboard data could not be loaded. Please try again."
              action={{ label: 'Retry', onClick: () => void refetch() }}
            />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-neutral-500">Total organizations</p>
              <p className="mt-3 text-3xl font-bold text-neutral-900">{summary.organizations.total}</p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-neutral-500">Active organizations</p>
              <p className="mt-3 text-3xl font-bold text-emerald-600">{summary.organizations.active}</p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-neutral-500">Suspended organizations</p>
              <p className="mt-3 text-3xl font-bold text-red-600">{summary.organizations.suspended}</p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}