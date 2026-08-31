'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { EmptyState, EmptyStateIcons, ErrorState, Spinner } from '@/components/ui';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { getOrgAdminErrorMessage } from '@/features/orgAdmin/orgAdminErrors';
import {
  PageHeader,
  StatCard,
  ChartCard,
  BarList,
  type BarDatum,
} from '@/components/dashboard';

type OrganizationInfo = {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
};

type DashboardSummary = {
  organization: OrganizationInfo;
  users: { total: number; instructors: number; students: number; organizationAdmins: number };
};

type CourseItem = { id: string; title: string; status: string; createdAt: string };

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
const statusBarTone = (status: string): BarDatum['tone'] => {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'ARCHIVED') return 'neutral';
  return 'warning';
};

const MembersIcon = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-4.974-2.337M14 20H2v-2a4 4 0 018-2.87M11 4a4 4 0 000 8M15.5 12a3.5 3.5 0 000-7M15 20h7v-2a3 3 0 00-2.97-3" />
  </svg>
);

const AdminsIcon = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />
  </svg>
);

const InstructorsIcon = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const StudentsIcon = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l9-5v6m-9 5l-6-3.333V10m12 0v6" />
  </svg>
);

export default function OrgAnalyticsPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const searchParams = useSearchParams();
  const orgIdParam = searchParams.get('organization');

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [courses, setCourses] = useState<CourseItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userLoading) return;
    if (!user || (user.role !== 'ORG_ADMIN' && user.role !== 'PLATFORM_ADMIN')) {
      window.location.href = '/login';
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const orgId = orgIdParam ?? user?.organizationId ?? '';
        const orgHeaders: Record<string, string> = orgId ? { 'X-Organization-Id': orgId } : {};
        const [dashRes, coursesRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/org/dashboard`, { credentials: 'include', headers: orgHeaders }),
          fetch(`${API_BASE}/api/v1/organizations/${orgId}/courses?page=1&limit=100`, { credentials: 'include' }),
        ]);

        if (!dashRes.ok) {
          let code: unknown = null;
          try {
            code = (await dashRes.json())?.error;
          } catch {
            code = null;
          }
          setError(getOrgAdminErrorMessage(code));
          return;
        }
        if (!coursesRes.ok) {
          setError('Could not load course analytics. Please try again.');
          return;
        }

        const dashData: { success?: boolean; data?: DashboardSummary } = await dashRes.json();
        const coursesData: { success?: boolean; data?: CourseItem[] } = await coursesRes.json();
        setSummary(dashData.data ?? null);
        setCourses(Array.isArray(coursesData.data) ? coursesData.data : []);
      } catch {
        setError('Could not reach the API. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [user, userLoading, orgIdParam]);

  const statusCounts = (courses ?? []).reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  const statusDistribution: BarDatum[] = Object.keys(statusCounts)
    .sort()
    .map((status) => ({
      label: status,
      value: statusCounts[status],
      tone: statusBarTone(status),
    }));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        subtitle="Organization Admin"
        title="Analytics"
          description={
            summary
              ? `Usage and engagement metrics for ${summary.organization.name}.`
              : 'Usage and engagement metrics for your organization.'
          }
          badges={
            summary
              ? [
                  {
                    label: summary.organization.status,
                    variant: summary.organization.status === 'ACTIVE' ? 'success' : 'error',
                  },
                ]
              : undefined
          }
        />

        {loading && summary === null ? (
          <div className="flex items-center gap-3 text-neutral-700">
            <Spinner size="lg" label="Loading analytics..." />
            <span>Loading analytics...</span>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState
              title="Unable to load analytics"
              message={error}
              action={{ label: 'Retry', onClick: () => setLoading(true) }}
            />
          </div>
        ) : summary ? (
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Total members"
                value={summary.users.total}
                icon={MembersIcon}
                tone="primary"
                hint="Everyone in your organization"
              />
              <StatCard
                label="Organization admins"
                value={summary.users.organizationAdmins}
                icon={AdminsIcon}
                tone="neutral"
                hint="Tenant-level administrators"
              />
              <StatCard
                label="Instructors"
                value={summary.users.instructors}
                icon={InstructorsIcon}
                tone="warning"
                hint="Course creators"
              />
              <StatCard
                label="Students"
                value={summary.users.students}
                icon={StudentsIcon}
                tone="success"
                hint="Active learners"
              />
            </div>

            <ChartCard
              title="Courses by status"
              description={
                courses
                  ? `${courses.length} total course${courses.length === 1 ? '' : 's'}`
                  : undefined
              }
            >
              {courses && courses.length === 0 ? (
                <EmptyState
                  icon={EmptyStateIcons.NoCourses}
                  title="No courses yet"
                  description="Create and publish courses to start tracking your catalog analytics."
                />
              ) : (
                <BarList data={statusDistribution} />
              )}
            </ChartCard>
          </>
        ) : null}
      </div>
  );
}
