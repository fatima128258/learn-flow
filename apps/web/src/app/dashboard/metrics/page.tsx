'use client';

import { useQuery } from '@tanstack/react-query';
import { Alert, CardSkeleton, ErrorState } from '@/components/ui';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { platformAdminNav } from '@/features/platformAdmin/nav';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { getJson } from '@/lib/api';

type MetricCard = {
  label: string;
  value: number;
  hint?: string;
};

type PlatformMetrics = {
  organizations: { total: number; active: number; suspended: number };
  users: { total: number };
  organizationAdmins: { total: number };
};

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

  const cards: MetricCard[] = metrics
    ? [
        { label: 'Total organizations', value: metrics.organizations.total },
        { label: 'Active organizations', value: metrics.organizations.active, hint: 'Suspended excluded' },
        { label: 'Suspended organizations', value: metrics.organizations.suspended },
        { label: 'Total users', value: metrics.users.total },
        { label: 'Organization admins', value: metrics.organizationAdmins.total, hint: 'Across all tenants' },
      ]
    : [];

  return (
    <DashboardLayout navLabel="Platform Admin" items={platformAdminNav}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Platform Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-neutral-900">Platform Metrics</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            High-level usage metrics for the entire LearnFlow platform.
          </p>
        </div>

        <div className="mb-6">
          <Alert variant="info">
            Revenue, enrollment growth, and per-instructor analytics require additional platform APIs and appear here
            once available. The figures below reflect the live organization and user counts.
          </Alert>
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-neutral-500">{card.label}</p>
                <p className="mt-3 text-4xl font-bold text-neutral-900">{card.value}</p>
                {card.hint && <p className="mt-2 text-xs text-neutral-400">{card.hint}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}