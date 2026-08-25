'use client';

import { useEffect, useState } from 'react';
import { Badge, EmptyState, EmptyStateIcons, ErrorState, Spinner } from '../../../components/ui';
import { getOrgAdminErrorMessage } from '../../../features/orgAdmin/orgAdminErrors';

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

export default function OrganizationDashboardPage() {
  const [user, setUser] = useState<{ name?: string | null; email?: string } | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [members, setMembers] = useState<MemberItem[] | null>(null);
  const [membersTotal, setMembersTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && summary === null && !error) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto flex max-w-5xl items-center gap-3 text-neutral-700">
          <Spinner size="lg" label="Loading organization dashboard..." />
          <span>Loading organization dashboard...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Organization Admin</p>
          {summary ? (
            <>
              <h1 className="mt-2 text-3xl font-bold text-neutral-900">{summary.organization.name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-neutral-700">
                <Badge variant={summary.organization.status === 'ACTIVE' ? 'success' : 'error'} size="sm">
                  {summary.organization.status}
                </Badge>
                <span className="text-sm text-neutral-500">{summary.organization.slug}</span>
                <span className="text-sm text-neutral-500">
                  Created {new Date(summary.organization.createdAt).toLocaleDateString()}
                </span>
              </div>
            </>
          ) : (
            <h1 className="mt-2 text-3xl font-bold text-neutral-900">Organization</h1>
          )}
          {user ? (
            <div className="mt-4 space-y-1 text-neutral-700">
              <p><span className="font-semibold">Name:</span> {user.name}</p>
              <p><span className="font-semibold">Email:</span> {user.email}</p>
            </div>
          ) : null}
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
            <div className="mb-8 grid gap-6 md:grid-cols-4">
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-neutral-500">Total members</p>
                <p className="mt-3 text-3xl font-bold text-neutral-900">{summary.users.total}</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-neutral-500">Organization admins</p>
                <p className="mt-3 text-3xl font-bold text-neutral-900">{summary.users.organizationAdmins}</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-neutral-500">Instructors</p>
                <p className="mt-3 text-3xl font-bold text-neutral-900">{summary.users.instructors}</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-neutral-500">Students</p>
                <p className="mt-3 text-3xl font-bold text-neutral-900">{summary.users.students}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-neutral-900">Members</h2>
                <p className="text-sm text-neutral-600">
                  {membersTotal !== null ? `${membersTotal} member${membersTotal === 1 ? '' : 's'}` : ''}
                </p>
              </div>
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
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {(members ?? []).map((member) => (
                      <tr key={member.id} className="hover:bg-neutral-50">
                        <td className="px-6 py-4 text-sm font-medium text-neutral-900">{member.name ?? '—'}</td>
                        <td className="px-6 py-4 text-sm text-neutral-700">{member.email}</td>
                        <td className="px-6 py-4">
                          <Badge variant={roleBadgeVariant(member.role)} size="sm">
                            {member.role}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-neutral-700">
                          {new Date(member.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
