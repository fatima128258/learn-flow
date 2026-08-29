'use client';

import { useEffect, useState } from 'react';
import { Badge, EmptyState, EmptyStateIcons, ErrorState, Spinner } from '@/components/ui';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { orgAdminNav } from '@/features/organizationAdmin/nav';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { getOrgAdminErrorMessage } from '@/features/orgAdmin/orgAdminErrors';

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
const courseStatusBadge = (status: string) => {
  if (status === 'PUBLISHED') return 'success' as const;
  if (status === 'ARCHIVED') return 'default' as const;
  return 'warning' as const;
};

export default function OrgAnalyticsPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [courses, setCourses] = useState<CourseItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userLoading) return;
    if (!user || user.role !== 'ORG_ADMIN') {
      window.location.href = '/login';
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const orgId = user?.organizationId ?? '';
        const [dashRes, coursesRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/org/dashboard`, { credentials: 'include' }),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userLoading]);

  const statusCounts = (courses ?? []).reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <DashboardLayout navLabel="Organization Admin" items={orgAdminNav}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Organization Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-neutral-900">Analytics</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            Usage and engagement metrics for <span className="font-semibold">{summary?.organization.name ?? 'your organization'}</span>.
          </p>
        </div>

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
            <div className="mb-8 grid gap-6 md:grid-cols-4">
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-neutral-500">Total members</p>
                <p className="mt-3 text-3xl font-bold text-neutral-900">{summary.users.total}</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-neutral-500">Instructors</p>
                <p className="mt-3 text-3xl font-bold text-neutral-900">{summary.users.instructors}</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-neutral-500">Students</p>
                <p className="mt-3 text-3xl font-bold text-neutral-900">{summary.users.students}</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-neutral-500">Organization admins</p>
                <p className="mt-3 text-3xl font-bold text-neutral-900">{summary.users.organizationAdmins}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="border-b border-neutral-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-neutral-900">Courses by status</h2>
              </div>
              {courses && courses.length === 0 ? (
                <EmptyState
                  icon={EmptyStateIcons.NoCourses}
                  title="No courses yet"
                  description="Create and publish courses to start tracking your catalog analytics."
                />
              ) : (
                <div className="grid gap-4 p-6 sm:grid-cols-3">
                  {Object.keys(statusCounts)
                    .sort()
                    .map((status) => (
                      <div key={status} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                        <div className="flex items-center justify-between">
                          <Badge variant={courseStatusBadge(status)} size="sm">{status}</Badge>
                          <span className="text-2xl font-bold text-neutral-900">{statusCounts[status]}</span>
                        </div>
                      </div>
                    ))}
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-neutral-600">Total courses</span>
                      <span className="text-2xl font-bold text-neutral-900">{courses?.length ?? 0}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}