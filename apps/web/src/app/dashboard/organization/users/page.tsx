'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Badge,
  Button,
  EmptyState,
  EmptyStateIcons,
  ErrorState,
  Input,
  Modal,
  Spinner,
} from '@/components/ui';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { getOrgAdminErrorMessage } from '@/features/orgAdmin/orgAdminErrors';
import { getCreateInstructorErrorMessage } from '@/features/orgAdmin/createInstructorError';
import { PasswordInput } from '@/components/forms/PasswordInput';
import { useToast } from '@/components/ui/ToastProvider';
import {
  PageHeader,
  StatCard,
  TableCard,
  UserAvatar,
  tableHeadClass,
  tableCellClass,
  tableRowHoverClass,
} from '@/components/dashboard';

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

const API_BASE = '';

export default function OrgUsersPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const toast = useToast();
  const searchParams = useSearchParams();
  const orgId = searchParams.get('organization');

  const [members, setMembers] = useState<MemberItem[] | null>(null);
  const [filteredMembers, setFilteredMembers] = useState<MemberItem[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [addRole, setAddRole] = useState<'INSTRUCTOR' | 'STUDENT'>('INSTRUCTOR');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [saving, setSaving] = useState(false);

  const orgHeaders: Record<string, string> = orgId ? { 'X-Organization-Id': orgId } : {};

  async function load() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/org/users?page=1&limit=100`, { credentials: 'include', headers: orgHeaders });
      if (!res.ok) {
        let code: unknown = null;
        try {
          code = (await res.json())?.error;
        } catch {
          code = null;
        }
        setError(getOrgAdminErrorMessage(code));
        return;
      }
      const body: UsersResponse = await res.json();
      setMembers(Array.isArray(body.data) ? body.data : []);
      setFilteredMembers(Array.isArray(body.data) ? body.data : []);
      setTotal(body.meta?.total ?? null);
    } catch {
      setError('Could not reach the API. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (value: string) => {
    setSearchInput(value);
    if (!members) return;
    
    const query = value.toLowerCase().trim();
    if (!query) {
      setFilteredMembers(members);
    } else {
      const filtered = members.filter((member) =>
        member.name?.toLowerCase() === query ||
        member.email?.toLowerCase() === query ||
        member.role?.toLowerCase() === query
      );
      setFilteredMembers(filtered);
    }
  };

  useEffect(() => {
    if (userLoading) return;
    if (!user || (user.role !== 'ORG_ADMIN' && user.role !== 'PLATFORM_ADMIN')) {
      window.location.href = '/login';
      return;
    }
    void (async () => { await load(); })();
  }, [user, userLoading]);

  function openAdd(role: 'INSTRUCTOR' | 'STUDENT') {
    setAddRole(role);
    setName('');
    setEmail('');
    setPassword('');
    setEmailError('');
    setPasswordError('');
    setShowAddModal(true);
  }

  function closeAdd() {
    if (saving) return;
    setShowAddModal(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const trimmedEmail = email.trim();
    let valid = true;
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address');
      toast.error('Please enter a valid email address');
      valid = false;
    } else {
      setEmailError('');
    }
    if (!password || password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      toast.error('Password must be at least 8 characters');
      valid = false;
    } else {
      setPasswordError('');
    }
    if (!valid) return;

    setSaving(true);
    try {
      const endpoint = addRole === 'INSTRUCTOR' ? '/api/v1/org/instructors' : '/api/v1/org/students';
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...orgHeaders },
        body: JSON.stringify({ name: name.trim() || undefined, email: trimmedEmail, password }),
        credentials: 'include',
      });

      let body: { success?: boolean; error?: string; data?: MemberItem } | null = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }

      if (!res.ok || !body?.data) {
        toast.error(getCreateInstructorErrorMessage(body?.error));
        setPassword('');
        return;
      }

      setShowAddModal(false);
      toast.success(`${body.data.email} was added as ${addRole === 'INSTRUCTOR' ? 'an instructor' : 'a student'}.`);
      setError(null);
      setLoading(true);
      await load();
    } catch {
      toast.error('Could not reach the API. Please try again.');
      setPassword('');
    } finally {
      setSaving(false);
    }
  }

  const memberCount = (members ?? []).length;
  const adminCount = (members ?? []).filter((m) => m.role === 'ORG_ADMIN').length;
  const instructorCount = (members ?? []).filter((m) => m.role === 'INSTRUCTOR').length;
  const studentCount = (members ?? []).filter((m) => m.role === 'STUDENT').length;

  return (
    <>
      <div className="mx-auto max-w-5xl">

        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Input
            variant="line"
            placeholder="Search by name, email, or role"
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            className="max-w-md"
          />
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Button size="sm" className="bg-gray-600 hover:bg-gray-700 text-white border-none" onClick={() => openAdd('STUDENT')}>
              Add Student
            </Button>
            <Button size="sm" variant="primary" onClick={() => openAdd('INSTRUCTOR')}>
              Add Instructor
            </Button>
          </div>
        </div>

        {loading && members === null ? (
          <div className="mx-auto flex max-w-5xl items-center gap-3 text-neutral-700">
            <Spinner size="lg" label="Loading members..." />
            <span>Loading members...</span>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState
              title="Unable to load users"
              message={error}
              action={{ label: 'Retry', onClick: () => { setError(null); setLoading(true); void load(); } }}
            />
          </div>
        ) : (
          <>
            <div className="mb-8 grid grid-cols-4 gap-4">
              <StatCard
                label="Total members"
                value={total ?? memberCount}
                icon={MembersIcon}
                tone="primary"
                hint="Everyone in your organization"
              />
              <StatCard
                label="Organization admins"
                value={adminCount}
                icon={AdminsIcon}
                tone="neutral"
                hint="Tenant-level administrators"
              />
              <StatCard
                label="Instructors"
                value={instructorCount}
                icon={InstructorsIcon}
                tone="warning"
                hint="Course creators"
              />
              <StatCard
                label="Students"
                value={studentCount}
                icon={StudentsIcon}
                tone="success"
                hint="Active learners"
              />
            </div>

            <TableCard
              title="Members"
              description={total !== null ? `${total} member${total === 1 ? '' : 's'}` : undefined}
            >
              {members && members.length === 0 ? (
                <EmptyState
                  icon={EmptyStateIcons.NoData}
                  title="No members yet"
                  description="Members of your organization will appear here. Add your first instructor or student to get started."
                />
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block">
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
                        {(filteredMembers ?? []).map((member) => (
                          <tr key={member.id} className={tableRowHoverClass}>
                            <td className={tableCellClass}>
                              <span className="flex items-center gap-3">
                                <UserAvatar name={member.name} size="sm" />
                                <span className="font-medium text-neutral-900">{member.name ?? '—'}</span>
                              </span>
                            </td>
                            <td className={`${tableCellClass} text-neutral-700`}>{member.email}</td>
                            <td className={tableCellClass}>
                              <Badge variant={roleBadgeVariant(member.role)} size="sm">{member.role}</Badge>
                            </td>
                            <td className={`${tableCellClass} text-neutral-700`}>
                              {new Date(member.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile cards */}
                  <div className="space-y-3 p-3 md:hidden">
                    {(filteredMembers ?? []).map((member) => (
                      <div key={member.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <UserAvatar name={member.name} size="sm" />
                            <p className="font-semibold text-neutral-900 truncate">{member.name ?? '—'}</p>
                          </div>
                          <Badge variant={roleBadgeVariant(member.role)} size="sm">{member.role}</Badge>
                        </div>
                        <div className="mt-3 space-y-1 border-t border-neutral-100 pt-3">
                          <p className="text-sm text-neutral-700 break-all">{member.email}</p>
                          <p className="text-xs text-neutral-400">{new Date(member.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TableCard>
          </>
        )}
      </div>

      <Modal isOpen={showAddModal} onClose={closeAdd} title={`Add ${addRole === 'INSTRUCTOR' ? 'Instructor' : 'Student'}`} closeOnOverlayClick={!saving}>
        <form onSubmit={handleAdd} noValidate>
          <div className="space-y-4">
            <Input
              label="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={addRole === 'INSTRUCTOR' ? 'e.g. Imran Instructor' : 'e.g. Sana Student'}
              autoComplete="off"
              disabled={saving}
            />
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
              placeholder="user@example.com"
              autoComplete="off"
              disabled={saving}
              required
            />
            <PasswordInput
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={passwordError}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              // helperText="Use at least 8 characters"
              disabled={saving}
              required
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={closeAdd} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Add {addRole === 'INSTRUCTOR' ? 'Instructor' : 'Student'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
