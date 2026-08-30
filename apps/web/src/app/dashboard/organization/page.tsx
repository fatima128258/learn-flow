'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  EmptyStateIcons,
  ErrorState,
  Input,
  Modal,
  Spinner,
} from '../../../components/ui';
import { FormError } from '../../../components/forms/FormError';
import { PasswordInput } from '../../../components/forms/PasswordInput';
import { getOrgAdminErrorMessage } from '../../../features/orgAdmin/orgAdminErrors';
import { getCreateInstructorErrorMessage } from '../../../features/orgAdmin/createInstructorError';
import { LinkButton } from '../../../components/ui/LinkButton';
import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import { orgAdminNav } from '../../../features/organizationAdmin/nav';
import {
  PageHeader,
  StatCard,
  TableCard,
  UserAvatar,
  tableHeadClass,
  tableCellClass,
  tableRowHoverClass,
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

function roleBadgeVariant(role: MemberRole) {
  if (role === 'PLATFORM_ADMIN') return 'primary' as const;
  if (role === 'ORG_ADMIN') return 'info' as const;
  if (role === 'INSTRUCTOR') return 'warning' as const;
  return 'default' as const;
}

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

export default function OrganizationDashboardPage() {
  const [user, setUser] = useState<{ name?: string | null; email?: string } | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [members, setMembers] = useState<MemberItem[] | null>(null);
  const [membersTotal, setMembersTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showInstructorModal, setShowInstructorModal] = useState(false);
  const [instructorName, setInstructorName] = useState('');
  const [instructorEmail, setInstructorEmail] = useState('');
  const [instructorPassword, setInstructorPassword] = useState('');
  const [instructorEmailError, setInstructorEmailError] = useState<string>('');
  const [instructorPasswordError, setInstructorPasswordError] = useState<string>('');
  const [createInstructorError, setCreateInstructorError] = useState<string | null>(null);
  const [creatingInstructor, setCreatingInstructor] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

      const [dashRes, usersRes] = await Promise.all([
        fetch(`${apiBase}/api/v1/org/dashboard`, { credentials: 'include' }),
        fetch(`${apiBase}/api/v1/org/users?page=1&limit=20`, { credentials: 'include' }),
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
      setMembers(Array.isArray(usersData.data) ? usersData.data : []);
      setMembersTotal(usersData.meta?.total ?? null);
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
    setCreateInstructorError(null);
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
    setCreateInstructorError(null);

    const trimmedEmail = instructorEmail.trim();
    let valid = true;

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setInstructorEmailError('Please enter a valid email address');
      valid = false;
    } else {
      setInstructorEmailError('');
    }

    if (!instructorPassword || instructorPassword.length < 8) {
      setInstructorPasswordError('Password must be at least 8 characters');
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
        headers: { 'Content-Type': 'application/json' },
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
        setCreateInstructorError(getCreateInstructorErrorMessage(body?.error));
        return;
      }

      const createdEmail = body.data.email;
      setShowInstructorModal(false);
      setSuccessMessage(`Instructor ${createdEmail} was added to your organization.`);
      await load();
    } catch {
      clearInstructorCredentials();
      setCreateInstructorError('Could not reach the API. Please try again.');
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
        if (meData.user?.role !== 'ORG_ADMIN') {
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
      <DashboardLayout navLabel="Organization Admin" items={orgAdminNav}>
        <div className="mx-auto flex max-w-5xl items-center gap-3 text-neutral-700">
          <Spinner size="lg" label="Loading organization dashboard..." />
          <span>Loading organization dashboard...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navLabel="Organization Admin" items={orgAdminNav}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <PageHeader
            subtitle="Organization Admin"
            title={summary ? summary.organization.name : 'Organization'}
            description={
              summary
                ? `${summary.organization.slug} · Created ${new Date(summary.organization.createdAt).toLocaleDateString()}`
                : user
                  ? `Signed in as ${user.name} · ${user.email}`
                  : 'Organization overview and membership'
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
            actions={
              <>
                <LinkButton href="/dashboard/organization/courses" size="sm" variant="outline">
                  My Courses
                </LinkButton>
                <LinkButton href="/dashboard/organization/courses/new" size="sm">
                  Create Course
                </LinkButton>
              </>
            }
          />
        </div>

        {successMessage ? (
          <div className="mb-6">
            <Alert variant="success" onDismiss={() => setSuccessMessage(null)}>
              {successMessage}
            </Alert>
          </div>
        ) : null}

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

            <TableCard
              title="Members"
              description={
                membersTotal !== null ? `${membersTotal} member${membersTotal === 1 ? '' : 's'}` : undefined
              }
              action={
                <Button size="sm" onClick={() => setShowInstructorModal(true)}>
                  Add Instructor
                </Button>
              }
            >
              {members && members.length === 0 ? (
                <EmptyState
                  icon={EmptyStateIcons.NoData}
                  title="No members yet"
                  description="Members of your organization will appear here."
                />
              ) : (
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className={tableHeadClass}>Name</th>
                      <th className={tableHeadClass}>Email</th>
                      <th className={tableHeadClass}>Role</th>
                      <th className={tableHeadClass}>Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {(members ?? []).map((member) => (
                      <tr key={member.id} className={tableRowHoverClass}>
                        <td className={tableCellClass}>
                          <span className="flex items-center gap-3">
                            <UserAvatar name={member.name} size="sm" />
                            <span className="font-medium text-neutral-900">{member.name ?? '—'}</span>
                          </span>
                        </td>
                        <td className={`${tableCellClass} text-neutral-700`}>{member.email}</td>
                        <td className={tableCellClass}>
                          <Badge variant={roleBadgeVariant(member.role)} size="sm">
                            {member.role}
                          </Badge>
                        </td>
                        <td className={`${tableCellClass} text-neutral-700`}>
                          {new Date(member.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </TableCard>
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
            {createInstructorError ? <FormError message={createInstructorError} /> : null}

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
    </DashboardLayout>
  );
}
