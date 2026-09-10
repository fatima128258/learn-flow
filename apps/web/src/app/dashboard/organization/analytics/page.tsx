'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { EmptyState, EmptyStateIcons, ErrorState, Spinner } from '@/components/ui';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { getOrgAdminErrorMessage } from '@/features/orgAdmin/orgAdminErrors';
import {
  StatCard,
  ChartCard,
  LineChart,
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

type OrgAnalytics = {
  organization?: { id: string; name: string };
  enrollments?: {
    total: number;
    enrolledStudents: number;
    trend: Array<{ date: string; count: number }>;
    progress: { notStarted: number; inProgress: number; completed: number };
  };
  courses?: { published: number; draft: number };
};

type OrganizationEnrollment = {
  id: string;
  student: { name: string | null; email: string };
  course: { id: string; name: string };
  enrolledAt: string;
};

const enrollmentRanges = [
  { value: 7, label: 'Last 7 days' }, { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' }, { value: 365, label: 'Last 1 year' },
] as const;

const API_BASE = '';
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
  const [analyticsData, setAnalyticsData] = useState<OrgAnalytics | null>(null);
  const [enrollments, setEnrollments] = useState<OrganizationEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<7 | 30 | 90 | 365>(30);
  const [retry, setRetry] = useState(0);

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
        const [dashRes, analyticsRes, enrollmentsRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/org/dashboard`, { credentials: 'include', headers: orgHeaders }),
          fetch(`${API_BASE}/api/v1/org/analytics?range=${range}`, { credentials: 'include', headers: orgHeaders }),
          fetch(`${API_BASE}/api/v1/org/enrollments?limit=100`, { credentials: 'include', headers: orgHeaders }),
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
        if (!analyticsRes.ok) {
          setError('Could not load analytics. Please try again.');
          return;
        }
        if (!enrollmentsRes.ok) {
          setError('Could not load enrollments. Please try again.');
          return;
        }

        const dashData: { success?: boolean; data?: DashboardSummary } = await dashRes.json();
        const analyticsBody: { success?: boolean; data?: OrgAnalytics } = await analyticsRes.json();
        const enrollmentsBody: { success?: boolean; data?: OrganizationEnrollment[] } = await enrollmentsRes.json();
        setSummary(dashData.data ?? null);
        setAnalyticsData(analyticsBody.data ?? null);
        setEnrollments(enrollmentsBody.data ?? []);
      } catch {
        setError('Could not reach the API. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [user, userLoading, orgIdParam, range, retry]);

  const enrollmentTrend = (analyticsData?.enrollments?.trend ?? []).map((point) => ({
    label: new Date(`${point.date}T00:00:00.000Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
    value: point.count,
  }));
  const chartTrend = enrollmentTrend.length > 0
    ? enrollmentTrend
    : Array.from({ length: range }, (_, index) => {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - (range - index - 1));
      return {
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        value: 0,
      };
    });
  const enrollmentsByMonth = enrollments.reduce<Record<string, OrganizationEnrollment[]>>((months, enrollment) => {
    const month = new Date(enrollment.enrolledAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    (months[month] ??= []).push(enrollment);
    return months;
  }, {});
  return (
    <div className="mx-auto max-w-5xl">
      {loading && summary === null ? (
        <div className="flex items-center gap-3 text-neutral-700">
          <Spinner size="lg" label="Loading enrollments..." />
          <span>Loading enrollments...</span>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <ErrorState
            title="Unable to load enrollments"
            message={error}
            action={{ label: 'Retry', onClick: () => setRetry((value) => value + 1) }}
          />
        </div>
      ) : summary ? (
        <>
          <section aria-labelledby="enrollment-analytics-title" className="mb-8">
            {/* <h2 id="enrollment-analytics-title" className="mb-4 text-xl font-semibold text-neutral-900">Enrollment </h2> */}
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Total Enrolled Students" value={(analyticsData?.enrollments?.enrolledStudents ?? 0).toLocaleString()} tone="primary" hint="Unique students enrolled in this organization" />
              <StatCard label="Published Courses" value={(analyticsData?.courses?.published ?? 0).toLocaleString()} tone="success" hint="Published courses in this organization" />
              <StatCard label="Draft Courses" value={(analyticsData?.courses?.draft ?? 0).toLocaleString()} tone="warning" hint="Draft courses in this organization" />
            </div>
            <ChartCard
              title="Enrollment Trend"
              description="Daily enrollments from real enrollment records"
              action={<label className="text-sm text-neutral-600">Range <select aria-label="Enrollment date range" value={range} onChange={(event) => setRange(Number(event.target.value) as 7 | 30 | 90 | 365)} className="ml-2 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm">{enrollmentRanges.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>}
            >
              <LineChart data={chartTrend} color="#8b5cf6" height={240} />
              {!enrollmentTrend.some((point) => point.value > 0) && <p className="mt-2 text-center text-sm text-neutral-500">No enrollments in this period yet.</p>}
            </ChartCard>
          </section>

          <ChartCard title="Enrollment History" description="Student course purchases, grouped by month">
            {enrollments.length === 0 ? <EmptyState icon={EmptyStateIcons.NoData} title="No enrollments yet" description="Student course purchases will appear here." /> : (
              <div className="space-y-6">{Object.entries(enrollmentsByMonth).map(([month, monthlyEnrollments]) => <section key={month}><h3 className="mb-2 text-base font-semibold text-neutral-900">{month}</h3><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500"><tr><th className="px-3 py-3">Student</th><th className="px-3 py-3">Course Purchased</th><th className="px-3 py-3">Purchase Date</th></tr></thead><tbody className="divide-y divide-neutral-100">{monthlyEnrollments.map((enrollment) => <tr key={enrollment.id}><td className="px-3 py-3 font-medium text-neutral-900">{enrollment.student.name?.trim() || enrollment.student.email}</td><td className="px-3 py-3 text-neutral-700">{enrollment.course.name}</td><td className="px-3 py-3 text-neutral-600">{new Date(enrollment.enrolledAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })}</td></tr>)}</tbody></table></div></section>)}</div>
            )}
          </ChartCard>

        </>
      ) : null}
    </div>
  );
}
