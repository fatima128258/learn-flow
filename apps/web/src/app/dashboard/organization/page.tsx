'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Button,
  EmptyState,
  EmptyStateIcons,
  ErrorState,
  Input,
  Modal,
  Spinner,
} from '../../../components/ui';
import { PasswordInput } from '../../../components/forms/PasswordInput';
import { getOrgAdminErrorMessage } from '../../../features/orgAdmin/orgAdminErrors';
import { getCreateInstructorErrorMessage } from '../../../features/orgAdmin/createInstructorError';
import { useToast } from '../../../components/ui/ToastProvider';
import {
  PageHeader,
  StatCard,
  Calendar,
  ChartCard,
  LineChart,
} from '../../../components/dashboard';

type OrganizationInfo = {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
};

type DashboardSummary = {
  organization: OrganizationInfo;
  users: { total: number; instructors: number; students: number; organizationAdmins: number };
};

type MemberRole = 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'INSTRUCTOR' | 'STUDENT';

type MemberItem = {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  role: MemberRole;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
};

type UsersResponse = {
  success?: boolean;
  data?: MemberItem[];
  meta?: { page: number; limit: number; total: number };
  error?: string;
};

type MeResponse = {
  user?: {
    id?: string;
    name?: string | null;
    email?: string;
    role?: string | null;
  };
};

type GrowthPoint = { month: string; members: number };
type OrgAnalytics = {
  organization?: { id: string; name: string };
  growth?: GrowthPoint[];
};

function roleBadgeVariant(role: MemberRole) {
  if (role === 'PLATFORM_ADMIN') return 'primary' as const;
  if (role === 'ORG_ADMIN') return 'info' as const;
  if (role === 'INSTRUCTOR') return 'warning' as const;
  return 'default' as const;
}

const InstructorsIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const StudentsIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l9-5v6m-9 5l-6-3.333V10m12 0v6" />
  </svg>
);

const CoursesIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

export default function OrganizationDashboardPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const orgId = searchParams.get('organization');

  const [user, setUser] = useState<{ name?: string | null; email?: string } | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [courseCount, setCourseCount] = useState<number | null>(null);
  const [members, setMembers] = useState<MemberItem[] | null>(null);
  const [membersTotal, setMembersTotal] = useState<number | null>(null);
  const [analyticsData, setAnalyticsData] = useState<OrgAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showInstructorModal, setShowInstructorModal] = useState(false);
  const [instructorName, setInstructorName] = useState('');
  const [instructorEmail, setInstructorEmail] = useState('');
  const [instructorPassword, setInstructorPassword] = useState('');
  const [instructorEmailError, setInstructorEmailError] = useState<string>('');
  const [instructorPasswordError, setInstructorPasswordError] = useState<string>('');
  const [creatingInstructor, setCreatingInstructor] = useState(false);

  const orgHeaders: Record<string, string> = orgId ? { 'X-Organization-Id': orgId } : {};

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

      const [dashRes, usersRes, analyticsRes] = await Promise.all([
        fetch(`${apiBase}/api/v1/org/dashboard`, { credentials: 'include', headers: orgHeaders }),
        fetch(`${apiBase}/api/v1/org/users?page=1&limit=20`, { credentials: 'include', headers: orgHeaders }),
        fetch(`${apiBase}/api/v1/org/analytics`, { credentials: 'include', headers: orgHeaders }),
      ]);

      let courseCountValue: number | null = null;
      if (orgId) {
        try {
          const coursesRes = await fetch(
            `${apiBase}/api/v1/organizations/${orgId}/courses`,
            { credentials: 'include' }
          );
          if (coursesRes.ok) {
            const coursesBody: { success?: boolean; data?: unknown[] } = await coursesRes.json();
            courseCountValue = Array.isArray(coursesBody.data) ? coursesBody.data.length : null;
          }
        } catch {
          courseCountValue = null;
        }
      }

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

      const dashData: { success?: boolean; data?: DashboardSummary } = await dashRes.json();
      if (!usersRes.ok) {
        let code: unknown = null;
        try {
          code = (await usersRes.json())?.error;
        } catch {
          code = null;
        }
        setError(getOrgAdminErrorMessage(code));
        return;
      }

      const usersData: UsersResponse = await usersRes.json();

      setSummary(dashData.data ?? null);
      setCourseCount(courseCountValue);
      setMembers(Array.isArray(usersData.data) ? usersData.data : []);
      setMembersTotal(usersData.meta?.total ?? null);

      if (analyticsRes.ok) {
        const analyticsBody: { success?: boolean; data?: OrgAnalytics } = await analyticsRes.json();
        setAnalyticsData(analyticsBody.data ?? null);
        setAnalyticsError(false);
      } else {
        setAnalyticsData(null);
        setAnalyticsError(true);
      }
    } catch {
      setError('Could not reach the API. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function closeInstructorModal() {
    if (creatingInstructor) return;
    setShowInstructorModal(false);
    setInstructorName('');
    setInstructorEmail('');
    setInstructorPassword('');
    setInstructorEmailError('');
    setInstructorPasswordError('');
  }

  function clearInstructorCredentials() {
    setInstructorName('');
    setInstructorEmail('');
    setInstructorPassword('');
    setInstructorEmailError('');
    setInstructorPasswordError('');
  }

  async function handleCreateInstructor(e: React.FormEvent) {
    e.preventDefault();
    if (creatingInstructor) return;

    const trimmedEmail = instructorEmail.trim();
    let valid = true;

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setInstructorEmailError('Please enter a valid email address');
      toast.error('Please enter a valid email address');
      valid = false;
    } else {
      setInstructorEmailError('');
    }

    if (!instructorPassword || instructorPassword.length < 8) {
      setInstructorPasswordError('Password must be at least 8 characters');
      toast.error('Password must be at least 8 characters');
      valid = false;
    } else {
      setInstructorPasswordError('');
    }

    if (!valid) return;

    setCreatingInstructor(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/v1/org/instructors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...orgHeaders },
        body: JSON.stringify({
          name: instructorName.trim() || undefined,
          email: trimmedEmail,
          password: instructorPassword,
        }),
        credentials: 'include',
      });

      let body: { success?: boolean; error?: string; data?: MemberItem } | null = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }

      clearInstructorCredentials();

      if (!res.ok || !body?.data) {
        toast.error(getCreateInstructorErrorMessage(body?.error));
        return;
      }

      const createdEmail = body.data.email;
      setShowInstructorModal(false);
      toast.success(`${createdEmail} was added as an instructor.`);
      await load();
    } catch {
      clearInstructorCredentials();
      toast.error('Could not reach the API. Please try again.');
    } finally {
      setCreatingInstructor(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function guard() {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        const meRes = await fetch(`${apiBase}/api/v1/auth/me`, { credentials: 'include' });
        if (!active) return;
        if (!meRes.ok) {
          window.location.href = '/login';
          return;
        }
        const meData: MeResponse = await meRes.json();
        if (!active) return;
        if (meData.user?.role !== 'ORG_ADMIN' && meData.user?.role !== 'PLATFORM_ADMIN') {
          window.location.href = '/login';
          return;
        }
        setUser({
          name: meData.user?.name ?? 'Organization Admin',
          email: meData.user?.email ?? '',
        });
        await load();
      } catch {
        if (active) window.location.href = '/login';
      }
    }

    guard();
    return () => {
      active = false;
    };
  }, []);

  if (loading && summary === null && !error) {
    return (
      <div className="mx-auto flex max-w-5xl items-center gap-3 text-neutral-700">
        <Spinner size="lg" label="Loading organization dashboard..." />
        <span>Loading organization dashboard...</span>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <PageHeader title={summary ? summary.organization.name : 'Organization'} />
        </div>

        {error ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState
              title="Unable to load the organization dashboard"
              message={error}
              action={{ label: 'Retry', onClick: load }}
            />
          </div>
        ) : summary ? (
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Courses"
                value={courseCount ?? 0}
                icon={CoursesIcon}
                tone="primary"
                hint="Courses in your organization"
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

            {/* Analytics */}
            <div className="mb-8">
              <ChartCard
                title="Organization Growth"
                description={
                  analyticsData?.growth?.length
                    ? 'Cumulative members per month'
                    : undefined
                }
              >
                {analyticsError ? (
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-600">
                    Could not load growth analytics.
                  </div>
                ) : analyticsData && analyticsData.growth && analyticsData.growth.length > 0 ? (
                  <LineChart
                    data={analyticsData.growth.map((g) => ({ label: g.month, value: g.members }))}
                    color="#8b5cf6"
                    height={240}
                  />
                ) : (
                  <EmptyState
                    icon={EmptyStateIcons.NoData}
                    title="No membership history yet"
                    description="Member growth will appear as people join your organization."
                  />
                )}
              </ChartCard>
            </div>

            {/* Calendar */}
            <div className="mb-8">
              <Calendar />
            </div>
          </>
        ) : null}
      </div>

      <Modal
        isOpen={showInstructorModal}
        onClose={closeInstructorModal}
        title="Add Instructor"
        closeOnOverlayClick={!creatingInstructor}
      >
        <form onSubmit={handleCreateInstructor} noValidate>
          <div className="space-y-4">
            <Input
              label="Full name"
              value={instructorName}
              onChange={(e) => setInstructorName(e.target.value)}
              placeholder="e.g. Imran Instructor"
              autoComplete="off"
              disabled={creatingInstructor}
            />

            <Input
              label="Email address"
              type="email"
              value={instructorEmail}
              onChange={(e) => setInstructorEmail(e.target.value)}
              error={instructorEmailError}
              placeholder="instructor@example.com"
              autoComplete="off"
              disabled={creatingInstructor}
              required
            />

            <PasswordInput
              label="Password"
              value={instructorPassword}
              onChange={(e) => setInstructorPassword(e.target.value)}
              error={instructorPasswordError}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              // helperText="Use at least 8 characters"
              disabled={creatingInstructor}
              required
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={closeInstructorModal} disabled={creatingInstructor}>
                Cancel
              </Button>
              <Button type="submit" loading={creatingInstructor}>
                Add Instructor
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
