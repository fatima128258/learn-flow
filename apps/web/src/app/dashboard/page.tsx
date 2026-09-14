'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

export default function DashboardPage() {
  const router = useRouter();
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
    // Only redirect after auth state is fully resolved (not loading AND we have a definitive answer)
    if (userLoading) return;
    
    // If user is authenticated but NOT a PLATFORM_ADMIN, redirect to their appropriate dashboard
    if (user && user.role !== 'PLATFORM_ADMIN') {
      const target =
        user.role === 'ORG_ADMIN'
          ? '/dashboard/organization'
          : user.role === 'INSTRUCTOR'
            ? '/dashboard/instructor'
            : user.role === 'STUDENT'
              ? '/dashboard/student'
              : '/';
      router.push(target);
      return;
    }
    
    // If auth check completed but no user found, redirect to login
    if (!userLoading && !user) {
      router.push('/login');
    }
  }, [user, userLoading, router]);

  const busy = userLoading || summaryLoading;
  const welcomeName = user?.name?.trim() || user?.email || 'there';

  // Don't render dashboard content until we confirm user is PLATFORM_ADMIN
  if (userLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      </div>
    );
  }

  // If auth resolved but user is not PLATFORM_ADMIN, show nothing (redirect will happen in useEffect)
  if (!user || user.role !== 'PLATFORM_ADMIN') {
    return null;
  }

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
          title={`Welcome, ${welcomeName}`}
          className="-mt-4 mb-0 !py-1"
        />

        {busy ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <StatCard className="rounded-xl border-[#ead8c6] bg-[#fffaf5] p-4 shadow-[0_4px_14px_rgba(90,50,31,0.08)]" label="Total organizations" value={summary.organizations.total} icon={OrgIcon} tone="primary" hint="All registered" />
              <StatCard className="rounded-xl border-[#ead8c6] bg-[#fffaf5] p-4 shadow-[0_4px_14px_rgba(90,50,31,0.08)]" label="Active organizations" value={summary.organizations.active} icon={OrgIcon} tone="success" hint="Currently active" />
              <StatCard className="rounded-xl border-[#ead8c6] bg-[#fffaf5] p-4 shadow-[0_4px_14px_rgba(90,50,31,0.08)]" label="Suspended organizations" value={summary.organizations.suspended} icon={OrgIcon} tone="danger" hint="Currently suspended" />
            </div>

            <div className="mb-8">
              <ChartCard
                className="rounded-xl border-[#ead8c6] bg-[#fffaf5] p-4 shadow-[0_4px_14px_rgba(90,50,31,0.08)]"
                title="Organizations created this month"
                description="Daily breakdown of new organization registrations"
              >
                <LineChart data={chartData} color="#7A4A2E" showArea={true} />
              </ChartCard>
            </div>

            <div className="w-full">
              <Calendar className="rounded-xl border-[#ead8c6] bg-[#fffaf5] shadow-[0_4px_14px_rgba(90,50,31,0.08)]" />
            </div>
          </>
        )}
      </div>
  );
}
