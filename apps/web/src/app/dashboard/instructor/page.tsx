'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ErrorState, Spinner } from '@/components/ui';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { getJson } from '@/lib/api';
import { Calendar, ChartCard, LineChart, PageHeader, StatCard, StatCardSkeleton } from '@/components/dashboard';

type InstructorDashboard = {
  totalCourses: number;
  publishedCourses: number;
  draftCourses: number;
  trend: Array<{ date: string; count: number }>;
};

export default function InstructorDashboardPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const organizationId = user?.organizationId ?? '';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['instructor', 'dashboard', organizationId, user?.id],
    queryFn: async () => {
      const response = await getJson<{ data?: InstructorDashboard }>(
        `/api/v1/instructor/${organizationId}/dashboard`,
      );
      return response.data ?? null;
    },
    enabled: user?.role === 'INSTRUCTOR' && Boolean(organizationId),
  });

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }
    if (user.role !== 'INSTRUCTOR') {
      window.location.href = user.role === 'ORG_ADMIN' ? '/dashboard/organization'
        : user.role === 'PLATFORM_ADMIN' ? '/dashboard'
          : user.role === 'STUDENT' ? '/dashboard/student' : '/login';
    }
  }, [user, userLoading]);

  const chartData = (data?.trend ?? []).map((point) => ({
    label: new Date(`${point.date}T00:00:00.000Z`).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', timeZone: 'UTC',
    }),
    value: point.count,
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={`Welcome, ${user?.name ?? 'Instructor'}`} />

      {isLoading || userLoading ? (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3"><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></div>
          <div className="flex items-center gap-3 text-neutral-700"><Spinner size="lg" label="Loading instructor dashboard..." /><span>Loading instructor dashboard...</span></div>
        </>
      ) : isError ? (
        <ErrorState title="Unable to load your dashboard" message="Your course and enrollment data could not be loaded." action={{ label: 'Retry', onClick: () => void refetch() }} />
      ) : data ? (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Total Courses" value={data.totalCourses.toLocaleString()} tone="primary" hint="Courses you created" />
            <StatCard label="Published Courses" value={data.publishedCourses.toLocaleString()} tone="success" hint="Live courses available to students" />
            <StatCard label="Draft Courses" value={data.draftCourses.toLocaleString()} tone="warning" hint="Courses not published yet" />
          </div>

          <div className="mb-8">
            <ChartCard title="This Month's Student Purchases" description="Unique students who enrolled in your courses this month">
              <LineChart data={chartData} color="#8b5cf6" height={260} />
            </ChartCard>
          </div>

          <Calendar />
        </>
      ) : null}
    </div>
  );
}
