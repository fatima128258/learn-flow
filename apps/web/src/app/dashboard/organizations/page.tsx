'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Badge,
  Button,
  ConfirmModal,
  EmptyState,
  EmptyStateIcons,
  ErrorState,
  Input,
  Modal,
  Spinner,
} from '../../../components/ui';
import { getCreateOrganizationErrorMessage } from '../../../features/admin/createOrganizationError';
import { getEditOrganizationErrorMessage } from '../../../features/admin/editOrganizationError';
import { getOrganizationStatusErrorMessage } from '../../../features/admin/organizationStatusError';
import { getOrganizationMembersErrorMessage } from '../../../features/admin/organizationMembersError';
import { getAssignAdminErrorMessage } from '../../../features/admin/assignAdminError';
import { PasswordInput } from '../../../components/forms/PasswordInput';
import { useToast } from '../../../components/ui/ToastProvider';
import {
  PageHeader,
  StatCard,
  TableCard,
  tableHeadClass,
  tableCellClass,
  tableRowHoverClass,
} from '../../../components/dashboard';

type OrganizationAdmin = {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  role: string;
};

type OrganizationItem = {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  admins?: OrganizationAdmin[];
};

type OrganizationsResponse = {
  success?: boolean;
  data?: OrganizationItem[];
  meta?: { page: number; limit: number; total: number };
};

type CreateOrganizationResponse = {
  success?: boolean;
  data?: OrganizationItem;
  error?: string;
};

type UpdateOrganizationResponse = CreateOrganizationResponse;

type StatusAction = {
  org: OrganizationItem;
  next: 'ACTIVE' | 'SUSPENDED';
};

type StatusUpdateResponse = {
  success?: boolean;
  data?: OrganizationItem;
  error?: string;
};

type MemberRole = 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'INSTRUCTOR' | 'STUDENT';

type MemberItem = {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  role: MemberRole;
  joinedAt: string;
};

type MembersData = {
  organization?: { id: string; name: string; slug: string; status: string };
  members?: MemberItem[];
};

type MembersResponse = {
  success?: boolean;
  data?: MembersData;
  meta?: { page: number; limit: number; total: number };
  error?: string;
};

type AssignAdminMode = 'existing' | 'new';

type AssignAdminResponse = {
  success?: boolean;
  data?: {
    organizationId: string;
    role: string;
    user?: { id: string; name: string | null; email: string; emailVerified: boolean };
  };
  error?: string;
};

type MeResponse = {
  user?: { role?: string | null };
};

const OrgIcon = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H3m4-12h4m-4 4h4m-4 4h4m4-8h2m-2 4h2m-2 4h2" />
  </svg>
);

// ── 3-dot actions dropdown ─────────────────────────────────────────────────
function OrgActionsMenu({
  org,
  onMembers,
  onAssignAdmin,
  onEdit,
  onStatusChange,
}: {
  org: OrganizationItem;
  onMembers: () => void;
  onAssignAdmin: () => void;
  onEdit: () => void;
  onStatusChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function action(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <div ref={menuRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Organization actions"
        aria-haspopup="true"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        {/* 3 vertical dots */}
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="4" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-44 origin-top-right rounded-xl border border-neutral-200 bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none">
          <button
            type="button"
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900"
            onClick={() => action(onMembers)}
          >
            <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5.356-3.712M9 20H4v-2a4 4 0 015.356-3.712M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Members
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900"
            onClick={() => action(onAssignAdmin)}
          >
            <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Assign Admin
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900"
            onClick={() => action(onEdit)}
          >
            <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <div className="my-1 border-t border-neutral-100" />
          <button
            type="button"
            className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-neutral-50 ${
              org.status === 'ACTIVE'
                ? 'text-red-600 hover:text-red-700'
                : 'text-emerald-600 hover:text-emerald-700'
            }`}
            onClick={() => action(onStatusChange)}
          >
            {org.status === 'ACTIVE' ? (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Suspend
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Activate
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default function OrganizationsPage() {
  const toast = useToast();

  const [organizations, setOrganizations] = useState<OrganizationItem[] | null>(null);
  const [meta, setMeta] = useState<OrganizationsResponse['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState<string>('');
  const [creating, setCreating] = useState(false);

  const [editingOrg, setEditingOrg] = useState<OrganizationItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameError, setEditNameError] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const [statusAction, setStatusAction] = useState<StatusAction | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const [membersOrg, setMembersOrg] = useState<OrganizationItem | null>(null);
  const [membersData, setMembersData] = useState<MembersData | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);

  const [assignOrg, setAssignOrg] = useState<OrganizationItem | null>(null);
  const [assignMode, setAssignMode] = useState<AssignAdminMode>('existing');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminEmailError, setAdminEmailError] = useState<string>('');
  const [adminPasswordError, setAdminPasswordError] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/v1/organizations`, { credentials: 'include' });
      if (!res.ok) {
        setError(`Failed to load organizations (HTTP ${res.status})`);
        return;
      }
      const body: OrganizationsResponse = await res.json();
      setOrganizations(Array.isArray(body.data) ? body.data : []);
      setMeta(body.meta ?? null);
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
        if (meData.user?.role !== 'PLATFORM_ADMIN') {
          window.location.href = '/login';
          return;
        }
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

  function closeCreateModal() {
    if (creating) return;
    setShowCreateModal(false);
    setNewName('');
    setNameError('');
  }

  function openEditModal(org: OrganizationItem) {
    setEditingOrg(org);
    setEditName(org.name);
    setEditNameError('');
  }

  function closeEditModal() {
    if (saving) return;
    setEditingOrg(null);
    setEditName('');
    setEditNameError('');
  }

  function requestStatusChange(org: OrganizationItem) {
    if (statusUpdating) return;
    setStatusAction({ org, next: org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' });
  }

  function openMembersModal(org: OrganizationItem) {
    setMembersOrg(org);
    setMembersData(null);
    setMembersLoading(true);

    (async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        const res = await fetch(`${apiBase}/api/v1/organizations/${org.id}/members`, {
          credentials: 'include',
        });

        let body: MembersResponse | null = null;
        try {
          body = await res.json();
        } catch {
          body = null;
        }

        if (!res.ok || !body?.data) {
          toast.error(getOrganizationMembersErrorMessage(body?.error));
          return;
        }
        setMembersData(body.data);
      } catch {
        toast.error('Could not reach the API. Please try again.');
      } finally {
        setMembersLoading(false);
      }
    })();
  }

  function closeMembersModal() {
    setMembersOrg(null);
    setMembersData(null);
    setMembersLoading(false);
  }

  function openAssignModal(org: OrganizationItem) {
    setAssignOrg(org);
    setAssignMode('existing');
    setAdminEmail('');
    setAdminName('');
    setAdminPassword('');
    setAdminEmailError('');
    setAdminPasswordError('');
  }

  function closeAssignModal() {
    if (assigning) return;
    setAssignOrg(null);
    setAssignMode('existing');
    setAdminEmail('');
    setAdminName('');
    setAdminPassword('');
    setAdminEmailError('');
    setAdminPasswordError('');
  }

  function clearAdminCredentials() {
    setAdminEmail('');
    setAdminName('');
    setAdminPassword('');
  }

  async function handleAssignAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (assigning || !assignOrg) return;

    const trimmedEmail = adminEmail.trim();
    let valid = true;

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setAdminEmailError('Please enter a valid email address');
      toast.error('Please enter a valid email address');
      valid = false;
    } else {
      setAdminEmailError('');
    }

    if (assignMode === 'new') {
      if (!adminPassword || adminPassword.length < 8) {
        setAdminPasswordError('Password must be at least 8 characters');
        toast.error('Password must be at least 8 characters');
        valid = false;
      } else {
        setAdminPasswordError('');
      }
    } else {
      setAdminPasswordError('');
    }

    if (!valid) return;

    setAssigning(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const body =
        assignMode === 'new'
          ? { name: adminName.trim() || undefined, email: trimmedEmail, password: adminPassword }
          : { email: trimmedEmail };

      const res = await fetch(`${apiBase}/api/v1/organizations/${assignOrg.id}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });

      let resBody: AssignAdminResponse | null = null;
      try {
        resBody = await res.json();
      } catch {
        resBody = null;
      }

      clearAdminCredentials();

      if (!res.ok || !resBody?.data?.user) {
        toast.error(getAssignAdminErrorMessage(resBody?.error));
        return;
      }

      const adminEmailAssigned = resBody.data.user.email;
      setAssignOrg(null);
      toast.success(`Organization admin ${adminEmailAssigned} assigned to "${assignOrg.name}".`);
      await load();
    } catch {
      clearAdminCredentials();
      toast.error('Could not reach the API. Please try again.');
    } finally {
      setAssigning(false);
    }
  }

  function closeStatusModal() {
    if (statusUpdating) return;
    setStatusAction(null);
  }

  async function handleStatusConfirm() {
    if (statusUpdating || !statusAction) return;
    const { org, next } = statusAction;

    setStatusUpdating(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/v1/organizations/${org.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
        credentials: 'include',
      });

      let body: StatusUpdateResponse | null = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }

      if (!res.ok || !body?.data) {
        toast.error(getOrganizationStatusErrorMessage(body?.error));
        setStatusAction(null);
        return;
      }

      setStatusAction(null);
      toast.success(
        next === 'SUSPENDED'
          ? `Organization "${body.data.name}" was suspended.`
          : `Organization "${body.data.name}" was activated.`
      );
      await load();
    } catch {
      toast.error('Could not reach the API. Please try again.');
      setStatusAction(null);
    } finally {
      setStatusUpdating(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;

    const trimmedName = newName.trim();
    if (!trimmedName) {
      setNameError('Organization name is required');
      toast.error('Organization name is required');
      return;
    }
    setNameError('');

    setCreating(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/v1/organizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
        credentials: 'include',
      });

      let body: CreateOrganizationResponse | null = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }

      if (!res.ok || !body?.data) {
        toast.error(getCreateOrganizationErrorMessage(body?.error));
        return;
      }

      setShowCreateModal(false);
      setNewName('');
      setNameError('');
      toast.success(`Organization "${body.data.name}" was created.`);
      await load();
    } catch {
      toast.error('Could not reach the API. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !editingOrg) return;

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditNameError('Organization name is required');
      toast.error('Organization name is required');
      return;
    }
    setEditNameError('');

    setSaving(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/v1/organizations/${editingOrg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
        credentials: 'include',
      });

      let body: UpdateOrganizationResponse | null = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }

      if (!res.ok || !body?.data) {
        toast.error(getEditOrganizationErrorMessage(body?.error));
        return;
      }

      const updatedName = body.data.name;
      setEditingOrg(null);
      setEditName('');
      setEditNameError('');
      toast.success(`Organization "${updatedName}" was updated.`);
      await load();
    } catch {
      toast.error('Could not reach the API. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const activeCount = organizations?.filter((org) => org.status === 'ACTIVE').length ?? 0;
  const suspendedCount = organizations?.filter((org) => org.status === 'SUSPENDED').length ?? 0;
  const totalOrganizations = meta?.total ?? organizations?.length ?? 0;

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredOrganizations = organizations
    ? organizations.filter((org) => {
        if (!normalizedSearch) return true;
        const adminMatch = org.admins?.some((admin) => admin.email.toLowerCase().includes(normalizedSearch)) ?? false;
        return (
          org.name.toLowerCase().includes(normalizedSearch) ||
          org.slug.toLowerCase().includes(normalizedSearch) ||
          org.status.toLowerCase().includes(normalizedSearch) ||
          adminMatch
        );
      })
    : [];

  if (loading && organizations === null && !error) {
    return (
      <div className="mx-auto flex max-w-5xl items-center gap-3 text-neutral-700">
        <Spinner size="lg" label="Loading organizations..." />
        <span>Loading organizations...</span>
      </div>
    );
  }

  return (
    <>
    <div className="mx-auto max-w-5xl">
        <div className="mb-4 max-w-sm">
          <Input
            variant="line"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, slug, or admin email"
          />
        </div>

        {error ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState
              title="Unable to load organizations"
              message={error}
              action={{ label: 'Retry', onClick: load }}
            />
          </div>
        ) : organizations && organizations.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <EmptyState
              icon={EmptyStateIcons.NoData}
              title="No organizations yet"
              description="Organizations will appear here once they are created."
            />
          </div>
        ) : organizations ? (
          <>
            {filteredOrganizations.length === 0 ? (
              <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <EmptyState
                  icon={EmptyStateIcons.NoData}
                  title="No matching organizations"
                  description={`Nothing matched "${searchTerm}". Try a different search.`}
                />
              </div>
            ) : (
              <>
            <TableCard>
              {/* ── Desktop table (md+) ───────────────────────────────── */}
              <div className="hidden md:block">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className={tableHeadClass}>Name</th>
                      <th className={tableHeadClass}>Status</th>
                      <th className={tableHeadClass}>Email</th>
                      <th className={tableHeadClass}>Members</th>
                      <th className={tableHeadClass}>Created</th>
                      <th className={tableHeadClass}>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {filteredOrganizations.map((org) => (
                      <tr key={org.id} className={tableRowHoverClass}>
                        <td className={tableCellClass}>
                          <p className="font-medium text-neutral-900">{org.name}</p>
                        </td>
                        <td className={tableCellClass}>
                          <Badge variant={org.status === 'ACTIVE' ? 'success' : 'error'} size="sm">
                            {org.status}
                          </Badge>
                        </td>
                        <td className={tableCellClass}>
                          {org.admins && org.admins.length > 0 ? (
                            <div className="space-y-2">
                              {org.admins.map((admin) => (
                                <div key={admin.id}>
                                  <p className="text-sm text-neutral-600">{admin.email}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-neutral-400">No admin assigned</span>
                          )}
                        </td>
                        <td className={`${tableCellClass} text-neutral-700`}>
                          {typeof org.memberCount === 'number' ? org.memberCount : '—'}
                        </td>
                        <td className={`${tableCellClass} text-neutral-700`}>
                          {new Date(org.createdAt).toLocaleDateString()}
                        </td>
                        <td className={`${tableCellClass} text-right`}>
                          <OrgActionsMenu
                            org={org}
                            onMembers={() => openMembersModal(org)}
                            onAssignAdmin={() => openAssignModal(org)}
                            onEdit={() => openEditModal(org)}
                            onStatusChange={() => requestStatusChange(org)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </TableCard>

            {/* ── Mobile cards (< md) ───────────────────────────────── */}
            <div className="mt-3 space-y-3 md:hidden">
              {filteredOrganizations.map((org) => (
                <div
                  key={org.id}
                  className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
                >
                  {/* Top row: name + actions */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-base font-semibold text-neutral-900 leading-snug">
                      {org.name}
                    </p>
                    <div className="shrink-0">
                      <OrgActionsMenu
                        org={org}
                        onMembers={() => openMembersModal(org)}
                        onAssignAdmin={() => openAssignModal(org)}
                        onEdit={() => openEditModal(org)}
                        onStatusChange={() => requestStatusChange(org)}
                      />
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="mt-2">
                    <Badge variant={org.status === 'ACTIVE' ? 'success' : 'error'} size="sm">
                      {org.status}
                    </Badge>
                  </div>

                  {/* Admin email — full, no truncation */}
                  <div className="mt-3 border-t border-neutral-100 pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-neutral-400 mb-1">
                      Admin email
                    </p>
                    {org.admins && org.admins.length > 0 ? (
                      org.admins.map((admin) => (
                        <p key={admin.id} className="text-sm text-neutral-700 break-all">
                          {admin.email}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm italic text-neutral-400">No admin assigned</p>
                    )}
                  </div>

                  {/* Footer: members + date */}
                  <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                    <span>
                      <span className="font-semibold text-neutral-700">
                        {typeof org.memberCount === 'number' ? org.memberCount : '—'}
                      </span>{' '}members
                    </span>
                    <span>
                      {new Date(org.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
              </>
            )}
          </>
        ) : null}
      </div>

      <Modal isOpen={showCreateModal} onClose={closeCreateModal} title="Create Organization" closeOnOverlayClick={!creating}>
        <form onSubmit={handleCreate} noValidate>
          <div className="space-y-4">
            <Input
              label="Organization name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              error={nameError}
              helperText="The URL slug will be generated automatically from the name."
              placeholder="e.g. Digitalsofts Academy"
              disabled={creating}
              autoFocus
              required
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={closeCreateModal} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" loading={creating}>
                Create Organization
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={editingOrg !== null}
        onClose={closeEditModal}
        title="Edit Organization"
        closeOnOverlayClick={!saving}
      >
        <form onSubmit={handleEdit} noValidate>
          <div className="space-y-4">
            <Input
              label="Organization name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              error={editNameError}
              helperText="The URL slug remains unchanged."
              disabled={saving}
              required
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={closeEditModal} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Save Changes
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={statusAction !== null}
        onClose={closeStatusModal}
        onConfirm={handleStatusConfirm}
        title={statusAction?.next === 'SUSPENDED' ? 'Suspend Organization' : 'Activate Organization'}
        message={
          statusAction?.next === 'SUSPENDED'
            ? `Are you sure you want to suspend "${statusAction?.org.name ?? ''}"?`
            : `Are you sure you want to activate "${statusAction?.org.name ?? ''}"?`
        }
        confirmLabel={statusAction?.next === 'SUSPENDED' ? 'Suspend' : 'Activate'}
        variant={statusAction?.next === 'SUSPENDED' ? 'danger' : 'primary'}
        loading={statusUpdating}
      />

      <Modal
        isOpen={membersOrg !== null}
        onClose={closeMembersModal}
        title={membersOrg ? `Members — ${membersOrg.name}` : 'Members'}
        size="lg"
      >
        {membersLoading ? (
          <div className="flex items-center justify-center gap-3 py-10 text-neutral-700">
            <Spinner size="lg" label="Loading members..." />
            <span>Loading members...</span>
          </div>
        ) : membersData && membersData.members && membersData.members.length === 0 ? (
          <EmptyState
            icon={EmptyStateIcons.NoData}
            title="No members yet"
            description="This organization does not have any members."
          />
        ) : membersData?.organization && membersData.members ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              {membersData.organization.name}
              <span className="mx-2 text-neutral-300">|</span>
              {membersData.members.length} member{membersData.members.length === 1 ? '' : 's'}
            </p>
            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className={tableHeadClass}>Name</th>
                    <th className={tableHeadClass}>Email</th>
                    <th className={tableHeadClass}>Role</th>
                    <th className={tableHeadClass}>Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {membersData.members.map((member) => (
                    <tr key={member.id} className={tableRowHoverClass}>
                      <td className={`${tableCellClass} font-medium text-neutral-900`}>
                        {member.name ?? '—'}
                      </td>
                      <td className={`${tableCellClass} text-neutral-700`}>{member.email}</td>
                      <td className={tableCellClass}>
                        <Badge
                          variant={
                            member.role === 'ORG_ADMIN'
                              ? 'info'
                              : member.role === 'INSTRUCTOR'
                                ? 'warning'
                                : 'default'
                          }
                          size="sm"
                        >
                          {member.role}
                        </Badge>
                      </td>
                      <td className={`${tableCellClass} text-neutral-700`}>
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={assignOrg !== null}
        onClose={closeAssignModal}
        title={assignOrg ? `Assign Admin — ${assignOrg.name}` : 'Assign Admin'}
        closeOnOverlayClick={!assigning}
      >
        <form onSubmit={handleAssignAdmin} noValidate>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant={assignMode === 'existing' ? 'primary' : 'outline'}
                onClick={() => setAssignMode('existing')}
                disabled={assigning}
              >
                Assign existing user
              </Button>
              <Button
                type="button"
                size="sm"
                variant={assignMode === 'new' ? 'primary' : 'outline'}
                onClick={() => setAssignMode('new')}
                disabled={assigning}
              >
                Create new admin
              </Button>
            </div>

            {assignMode === 'new' ? (
              <Input
                label="Full name"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="e.g. Mina Admin"
                autoComplete="off"
                disabled={assigning}
              />
            ) : null}

            <Input
              label="Email address"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              error={adminEmailError}
              placeholder="admin@example.com"
              autoComplete="off"
              disabled={assigning}
              required
            />

            {assignMode === 'new' ? (
              <PasswordInput
                label="Password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                error={adminPasswordError}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                // helperText="Use at least 8 characters"
                disabled={assigning}
                required
              />
            ) : null}

            <p className="text-xs text-neutral-500">
              {assignMode === 'existing'
                ? 'The user must already exist. They will be granted the ORG_ADMIN role for this organization.'
                : 'A new user account will be created with a verified email and granted the ORG_ADMIN role.'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={closeAssignModal} disabled={assigning}>
                Cancel
              </Button>
              <Button type="submit" loading={assigning}>
                Assign Admin
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
