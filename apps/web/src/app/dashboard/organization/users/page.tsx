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
} from '@/components/ui';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { orgAdminNav } from '@/features/organizationAdmin/nav';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { getOrgAdminErrorMessage } from '@/features/orgAdmin/orgAdminErrors';
import { getCreateInstructorErrorMessage } from '@/features/orgAdmin/createInstructorError';
import { FormError } from '@/components/forms/FormError';
import { PasswordInput } from '@/components/forms/PasswordInput';
import { useToast } from '@/components/ui/ToastProvider';

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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export default function OrgUsersPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const toast = useToast();

  const [members, setMembers] = useState<MemberItem[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addRole, setAddRole] = useState<'INSTRUCTOR' | 'STUDENT'>('INSTRUCTOR');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/org/users?page=1&limit=100`, { credentials: 'include' });
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
      setTotal(body.meta?.total ?? null);
    } catch {
      setError('Could not reach the API. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userLoading) return;
    if (!user || user.role !== 'ORG_ADMIN') {
      window.location.href = '/login';
      return;
    }
    void (async () => { await load(); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userLoading]);

  function openAdd(role: 'INSTRUCTOR' | 'STUDENT') {
    setAddRole(role);
    setName('');
    setEmail('');
    setPassword('');
    setEmailError('');
    setPasswordError('');
    setFormError(null);
    setShowAddModal(true);
  }

  function closeAdd() {
    if (saving) return;
    setShowAddModal(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError(null);

    const trimmedEmail = email.trim();
    let valid = true;
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address');
      valid = false;
    } else {
      setEmailError('');
    }
    if (!password || password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
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
        headers: { 'Content-Type': 'application/json' },
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
        setFormError(getCreateInstructorErrorMessage(body?.error));
        toast.error(getCreateInstructorErrorMessage(body?.error));
        setPassword('');
        return;
      }

      setShowAddModal(false);
      const roleLabel = addRole === 'INSTRUCTOR' ? 'Instructor' : 'Student';
      setSuccessMessage(`${roleLabel} ${body.data.email} was added to your organization.`);
      toast.success(`${body.data.email} was added as ${addRole === 'INSTRUCTOR' ? 'an instructor' : 'a student'}.`);
      setError(null);
      setLoading(true);
      await load();
    } catch {
      setFormError('Could not reach the API. Please try again.');
      setPassword('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout navLabel="Organization Admin" items={orgAdminNav}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Organization Admin</p>
              <h1 className="mt-2 text-3xl font-bold text-neutral-900">Users</h1>
            </div>
            <div className="flex gap-3">
              <Button size="sm" variant="outline" onClick={() => openAdd('STUDENT')}>
                Add Student
              </Button>
              <Button size="sm" onClick={() => openAdd('INSTRUCTOR')}>
                Add Instructor
              </Button>
            </div>
          </div>
        </div>

        {successMessage ? (
          <div className="mb-6">
            <Alert variant="success" onDismiss={() => setSuccessMessage(null)}>
              {successMessage}
            </Alert>
          </div>
        ) : null}

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
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-neutral-900">Members</h2>
              <p className="text-sm text-neutral-600">
                {total !== null ? `${total} member${total === 1 ? '' : 's'}` : ''}
              </p>
            </div>
            {members && members.length === 0 ? (
              <EmptyState
                icon={EmptyStateIcons.NoData}
                title="No members yet"
                description="Members of your organization will appear here. Add your first instructor or student to get started."
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
        )}
      </div>

      <Modal isOpen={showAddModal} onClose={closeAdd} title={`Add ${addRole === 'INSTRUCTOR' ? 'Instructor' : 'Student'}`} closeOnOverlayClick={!saving}>
        <form onSubmit={handleAdd} noValidate>
          <div className="space-y-4">
            {formError ? <FormError message={formError} /> : null}
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
    </DashboardLayout>
  );
}