'use client';

import { useQuery } from '@tanstack/react-query';
import { Alert, ErrorState } from '@/components/ui';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { getJson } from '@/lib/api';
import {
  PageHeader,
  StatCard,
  StatCardSkeleton,
  ChartCard,
  BarList,
  type BarDatum,
} from '@/components/dashboard';

type PlatformMetrics = {
  organizations: { total: number; active: number; suspended: number };
  users: { total: number };
  organizationAdmins: { total: number };
};

const OrgIcon = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H3m4-12h4m-4 4h4m-4 4h4m4-8h2m-2 4h2m-2 4h2" />
  </svg>
);

const UsersIcon = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const AdminsIcon = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />
  </svg>
);

export default function PlatformMetricsPage() {
  const { data: user } = useCurrentUser();

  const {
    data: metrics,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn: async () => {
      const body = await getJson<{ data?: PlatformMetrics }>('/api/v1/admin/dashboard');
      return body.data ?? null;
    },
    enabled: user?.role === 'PLATFORM_ADMIN',
  });

  const orgDistribution: BarDatum[] = metrics
    ? [
        { label: 'Active organizations', value: metrics.organizations.active, tone: 'success' },
        { label: 'Suspended organizations', value: metrics.organizations.suspended, tone: 'danger' },
      ]
    : [];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        subtitle="Platform Admin"
        title="Platform Metrics"
          description="High-level usage metrics for the entire LearnFlow platform."
        />

        <div className="mb-6">
          <Alert variant="info">
            Revenue, enrollment growth, and per-instructor analytics require additional platform APIs and appear here
            once available. The figures below reflect the live organization and user counts.
          </Alert>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        ) : error || !metrics ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState
              title="Unable to load platform metrics"
              message="The platform metrics could not be loaded. Please try again."
              action={{ label: 'Retry', onClick: () => void refetch() }}
            />
          </div>
        ) : (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <StatCard label="Total organizations" value={metrics.organizations.total} icon={OrgIcon} tone="primary" />
              <StatCard label="Active organizations" value={metrics.organizations.active} icon={OrgIcon} tone="success" hint="Suspended excluded" />
              <StatCard label="Suspended organizations" value={metrics.organizations.suspended} icon={OrgIcon} tone="danger" />
              <StatCard label="Total users" value={metrics.users.total} icon={UsersIcon} tone="info" />
              <StatCard label="Organization admins" value={metrics.organizationAdmins.total} icon={AdminsIcon} tone="neutral" hint="Across all tenants" />
            </div>

            <ChartCard
              title="Organization health"
              description="Distribution by status across the whole platform"
            >
              <BarList data={orgDistribution} />
            </ChartCard>
          </>
        )}
      </div>
  );
}
