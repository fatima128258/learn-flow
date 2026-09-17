'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import {
  Badge,
  Button,
  EmptyState,
  EmptyStateIcons,
  ErrorState,
  Drawer,
  Input,
  Modal,
  ConfirmModal,
  Spinner,
  ViewToggle,
} from '@/components/ui';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { getOrgAdminErrorMessage } from '@/features/orgAdmin/orgAdminErrors';
import { getCreateInstructorErrorMessage } from '@/features/orgAdmin/createInstructorError';
import { PasswordInput } from '@/components/forms/PasswordInput';
import { useToast } from '@/components/ui/ToastProvider';
import { isValidEmail } from '@/lib/validation';
import {
  TableCard,
  UserAvatar,
  tableHeadClass,
  tableCellClass,
  tableStatusClass,
  tableActionClass,
  tableRowHoverClass,
} from '@/components/dashboard';

type MemberRole = 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'INSTRUCTOR' | 'STUDENT';

type MemberItem = {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  role: MemberRole;
  status: 'ACTIVE' | 'SUSPENDED';
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  coursesCreated?: number;
  coursesPurchased?: number;
};

type UsersResponse = {
  success?: boolean;
  data?: MemberItem[];
  meta?: { page: number; limit: number; total: number };
  error?: string;
};

function MemberActionsMenu({ member, onView, onStatus }: { member: MemberItem; onView: () => void; onStatus: () => void }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 8 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  function toggle(event: React.MouseEvent) {
    event.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
    }
    setOpen(!open);
  }
  const menu = open ? (
    <div className="fixed z-[60] w-36 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg" style={{ top: position.top, right: position.right }} onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="block w-full border-0 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 focus:border-0 focus:outline-none focus-visible:border-0 focus-visible:outline-none focus:ring-0 focus-visible:ring-0" onClick={() => { setOpen(false); onView(); }}>View</button>
      <button type="button" className="block w-full border-0 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 focus:border-0 focus:outline-none focus-visible:border-0 focus-visible:outline-none focus:ring-0 focus-visible:ring-0" onClick={() => { setOpen(false); onStatus(); }}>{member.status === 'ACTIVE' ? 'Suspend' : 'Unsuspend'}</button>
    </div>
  ) : null;
  return <>
    <button ref={buttonRef} type="button" aria-label="Member actions" className="inline-flex items-center justify-center rounded-lg border-0 p-2 text-neutral-900 hover:bg-neutral-100 focus:border-0 focus:outline-none focus-visible:border-0 focus-visible:outline-none focus:ring-0 focus-visible:ring-0" onClick={toggle}>
      <span className="sr-only">Member actions</span><span aria-hidden="true">⋮</span>
    </button>
    {typeof document !== 'undefined' && menu ? createPortal(menu, document.body) : null}
  </>;
}

function roleBadgeVariant(role: MemberRole) {
  if (role === 'PLATFORM_ADMIN') return 'primary' as const;
  if (role === 'ORG_ADMIN') return 'info' as const;
  if (role === 'INSTRUCTOR') return 'warning' as const;
  return 'default' as const;
}

function roleLabel(role: MemberRole) {
  if (role === 'INSTRUCTOR') return 'Instructor';
  if (role === 'STUDENT') return 'Student';
  if (role === 'ORG_ADMIN') return 'Organization Admin';
  return 'Platform Admin';
}

const API_BASE = '';

export default function OrgUsersPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const toast = useToast();
  const searchParams = useSearchParams();
  const orgId = searchParams.get('organization');

  const [members, setMembers] = useState<MemberItem[] | null>(null);
  const [filteredMembers, setFilteredMembers] = useState<MemberItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const [showAddModal, setShowAddModal] = useState(false);
  const [addRole, setAddRole] = useState<'INSTRUCTOR' | 'STUDENT'>('INSTRUCTOR');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusTarget, setStatusTarget] = useState<MemberItem | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberItem | null>(null);
  const [memberDetailsLoading, setMemberDetailsLoading] = useState(false);

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
        member.name?.toLowerCase().includes(query) ||
        member.email?.toLowerCase().includes(query) ||
        member.role?.toLowerCase().includes(query)
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
    if (!isValidEmail(trimmedEmail)) {
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

  async function updateAccountStatus() {
    if (!statusTarget || updatingStatus) return;
    const suspending = statusTarget.status === 'ACTIVE';
    setUpdatingStatus(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/org/users/${statusTarget.id}/${suspending ? 'suspend' : 'unsuspend'}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: orgHeaders,
      });
      const body: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        const messages: Record<string, string> = {
          ACCOUNT_ALREADY_SUSPENDED: 'This account is already suspended.',
          ACCOUNT_ALREADY_ACTIVE: 'This account is already active.',
          ROLE_NOT_ALLOWED: 'This account cannot be managed from this organization.',
          USER_NOT_FOUND: 'The user could not be found in this organization.',
        };
        toast.error(messages[body.error ?? ''] ?? 'Could not update the account status. Please try again.');
        return;
      }

      toast.success(suspending ? 'Account suspended successfully.' : 'Account unsuspended successfully.');
      setStatusTarget(null);
      setLoading(true);
      await load();
    } catch {
      toast.error('Could not reach the API. Please try again.');
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function openMemberDetails(member: MemberItem) {
    setSelectedMember(member);
    setMemberDetailsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/org/users/${member.id}`, { credentials: 'include', headers: orgHeaders });
      if (!res.ok) throw new Error('Unable to load member details');
      const body: { data?: MemberItem } = await res.json();
      if (body.data) setSelectedMember(body.data);
    } catch {
      setSelectedMember(null);
      toast.error('Could not load member details. Please try again.');
    } finally {
      setMemberDetailsLoading(false);
    }
  }

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
            <Button size="sm" className="h-10 bg-gray-600 text-white hover:bg-gray-700 border-none" onClick={() => openAdd('STUDENT')}>
              Add Student
            </Button>
            <Button size="sm" variant="primary" className="h-10" onClick={() => openAdd('INSTRUCTOR')}>
              Add Instructor
            </Button>
            <ViewToggle value={viewMode} onChange={setViewMode} storageKey="learnhub-organization-users-view" />
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
            <TableCard>
              {members && members.length === 0 ? (
                <EmptyState
                  icon={EmptyStateIcons.NoData}
                  title="No members yet"
                  description="Members of your organization will appear here. Add your first instructor or student to get started."
                />
              ) : (
                <>
                  {/* Desktop table */}
                  <div className={viewMode === 'table' ? 'block' : 'hidden'}>
                    <table className="min-w-full divide-y divide-neutral-200">
                      <thead className="bg-neutral-50">
                        <tr>
                          <th className={tableHeadClass}>Name</th>
                          <th className={tableHeadClass}>Email</th>
                          <th className={`${tableHeadClass} text-center`}>Role</th>
                          <th className={tableHeadClass}>Created</th>
                          <th className={`${tableHeadClass} text-center`}>Action</th>
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
                            <td className={tableStatusClass}>
                              <Badge variant={roleBadgeVariant(member.role)} size="sm">{roleLabel(member.role)}</Badge>
                            </td>
                            <td className={`${tableCellClass} text-neutral-700`}>
                              {new Date(member.createdAt).toLocaleDateString()}
                            </td>
                            <td className={tableActionClass}>
                              <div className="flex items-center justify-center">
                                <MemberActionsMenu member={member} onView={() => void openMemberDetails(member)} onStatus={() => setStatusTarget(member)} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile cards */}
                  <div className={viewMode === 'cards' ? 'grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3' : 'hidden'}>
                    {(filteredMembers ?? []).map((member) => (
                      <div key={member.id} className="flex min-h-52 flex-col rounded-2xl border border-[#ead8c6] bg-[#fffdf9] p-5 shadow-sm transition-shadow hover:shadow-md">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <UserAvatar name={member.name} size="sm" />
                            <p className="truncate font-semibold text-[#17212b]">{member.name ?? '—'}</p>
                          </div>
                          <MemberActionsMenu member={member} onView={() => void openMemberDetails(member)} onStatus={() => setStatusTarget(member)} />
                        </div>
                        <div className="mt-5 flex-1 space-y-3 border-t border-[#ead8c6] pt-4">
                          <p className="break-all text-sm text-[#5f6368]">{member.email}</p>
                          <div className="flex items-center justify-between gap-3">
                            <Badge variant={roleBadgeVariant(member.role)} size="sm">{roleLabel(member.role)}</Badge>
                          </div>
                        </div>
                        <div className="mt-4 border-t border-[#ead8c6] pt-3 text-xs font-medium uppercase tracking-wide text-[#9b765c]">
                          Joined {new Date(member.createdAt).toLocaleDateString()}
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
      <ConfirmModal
        isOpen={!!statusTarget}
        onClose={() => { if (!updatingStatus) setStatusTarget(null); }}
        onConfirm={() => void updateAccountStatus()}
        title={statusTarget?.status === 'ACTIVE' ? 'Suspend account' : 'Unsuspend account'}
        message={statusTarget?.status === 'ACTIVE'
          ? 'Are you sure you want to suspend this account? The user will no longer be able to access LearnFlow until the account is unsuspended.'
          : 'Are you sure you want to unsuspend this account? The user will be able to log in and access LearnFlow again.'}
        confirmLabel={statusTarget?.status === 'ACTIVE' ? 'Suspend account' : 'Unsuspend account'}
        variant={statusTarget?.status === 'ACTIVE' ? 'danger' : 'primary'}
        loading={updatingStatus}
      />
      <Drawer isOpen={Boolean(selectedMember)} onClose={() => { if (!memberDetailsLoading) setSelectedMember(null); }} title={selectedMember?.name ?? 'Member details'}>
        {memberDetailsLoading ? (
          <div className="flex items-center gap-3 text-neutral-700"><Spinner size="md" label="Loading member details..." /><span>Loading member details...</span></div>
        ) : selectedMember ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#ead8c6] bg-[#fff9f0] p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <UserAvatar name={selectedMember.name} size="lg" />
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold text-neutral-900">{selectedMember.name ?? '—'}</h3>
                  <p className="truncate text-sm text-neutral-700">{selectedMember.email}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl border border-[#ead8c6] bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-neutral-900">Role</p><div className="mt-2"><Badge variant={roleBadgeVariant(selectedMember.role)} size="sm">{selectedMember.role}</Badge></div></div>
              <div className="rounded-xl border border-[#ead8c6] bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-neutral-900">Status</p><div className="mt-2"><Badge variant={selectedMember.status === 'ACTIVE' ? 'success' : 'warning'} size="sm">{selectedMember.status}</Badge></div></div>
              <div className="rounded-xl border border-[#ead8c6] bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-neutral-900">Created</p><p className="mt-2 break-words text-sm font-medium text-neutral-900">{new Date(selectedMember.createdAt).toLocaleString()}</p></div>
              <div className="rounded-xl border border-[#ead8c6] bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-neutral-900">Updated</p><p className="mt-2 break-words text-sm font-medium text-neutral-900">{new Date(selectedMember.updatedAt).toLocaleString()}</p></div>
            </div>
            <div className="rounded-2xl border border-[#ead8c6] bg-[#f8f2eb] p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-900">Activity</p>
              <p className="mt-2 text-sm font-medium text-neutral-900">{selectedMember.role === 'INSTRUCTOR' ? `Courses created: ${selectedMember.coursesCreated ?? 0}` : selectedMember.role === 'STUDENT' ? `Courses purchased: ${selectedMember.coursesPurchased ?? 0}` : 'Organization administration account'}</p>
            </div>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
