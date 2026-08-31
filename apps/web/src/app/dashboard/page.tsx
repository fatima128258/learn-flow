'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LinkButton } from '../../components/ui/LinkButton';
import { useCurrentUser } from '../../features/auth/useCurrentUser';
import { getJson } from '../../lib/api';
import { ErrorState } from '../../components/ui';
import {
  PageHeader,
  StatCard,
  StatCardSkeleton,
  Calendar,
  ChartCard,
  LineChart,
  type LineChartDatum,
} from '../../components/dashboard';

type DashboardSummary = {
  organizations: { total: number; active: number; suspended: number };
  users: { total: number };
  organizationAdmins: { total: number };
  organizationsThisMonth?: Array<{ day: number; count: number }>;
};

const OrgIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H3m4-12h4m-4 4h4m-4 4h4m4-8h2m-2 4h2m-2 4h2" />
  </svg>
);

const UsersIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const AdminsIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />
  </svg>
);

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

  // Prepare chart data
  const chartData: LineChartDatum[] = summary?.organizationsThisMonth
    ? summary.organizationsThisMonth.map((item) => {
        const now = new Date();
        const monthName = now.toLocaleString('en-US', { month: 'short' });
        return {
          label: `${item.day} ${monthName}`,
          value: item.count,
        };
      })
    : [];

  return (
    <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Platform Overview"
        />

        {busy ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
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
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <StatCard label="Total organizations" value={summary.organizations.total} icon={OrgIcon} tone="primary" hint="All registered" />
              <StatCard label="Active organizations" value={summary.organizations.active} icon={OrgIcon} tone="success" hint="Currently active" />
              <StatCard label="Suspended organizations" value={summary.organizations.suspended} icon={OrgIcon} tone="danger" hint="Currently suspended" />
              <StatCard label="Total users" value={summary.users.total} icon={UsersIcon} tone="info" hint="Across all orgs" />
              <StatCard label="Organization admins" value={summary.organizationAdmins.total} icon={AdminsIcon} tone="neutral" hint="Org-level admins" />
            </div>

            <div className="mb-8">
              <ChartCard
                title="Organizations created this month"
                description="Daily breakdown of new organization registrations"
              >
                <LineChart data={chartData} color="#10b981" showArea={true} />
              </ChartCard>
            </div>

            <div className="w-full">
              <Calendar />
            </div>
          </>
        )}
      </div>
  );
}