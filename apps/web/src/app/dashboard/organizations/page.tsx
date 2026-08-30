'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
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
import { FormError } from '../../../components/forms/FormError';
import { PasswordInput } from '../../../components/forms/PasswordInput';
import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import { platformAdminNav } from '../../../features/platformAdmin/nav';
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

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<OrganizationItem[] | null>(null);
  const [meta, setMeta] = useState<OrganizationsResponse['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState<string>('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [editingOrg, setEditingOrg] = useState<OrganizationItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameError, setEditNameError] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [statusAction, setStatusAction] = useState<StatusAction | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [membersOrg, setMembersOrg] = useState<OrganizationItem | null>(null);
  const [membersData, setMembersData] = useState<MembersData | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [assignOrg, setAssignOrg] = useState<OrganizationItem | null>(null);
  const [assignMode, setAssignMode] = useState<AssignAdminMode>('existing');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminEmailError, setAdminEmailError] = useState<string>('');
  const [adminPasswordError, setAdminPasswordError] = useState<string>('');
  const [assignError, setAssignError] = useState<string | null>(null);
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
    setCreateError(null);
  }

  function openEditModal(org: OrganizationItem) {
    setSuccessMessage(null);
    setEditingOrg(org);
    setEditName(org.name);
    setEditNameError('');
    setEditError(null);
  }

  function closeEditModal() {
    if (saving) return;
    setEditingOrg(null);
    setEditName('');
    setEditNameError('');
    setEditError(null);
  }

  function requestStatusChange(org: OrganizationItem) {
    if (statusUpdating) return;
    setSuccessMessage(null);
    setStatusError(null);
    setStatusAction({ org, next: org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' });
  }

  function openMembersModal(org: OrganizationItem) {
    setMembersOrg(org);
    setMembersData(null);
    setMembersError(null);
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
          setMembersError(getOrganizationMembersErrorMessage(body?.error));
          return;
        }
        setMembersData(body.data);
      } catch {
        setMembersError('Could not reach the API. Please try again.');
      } finally {
        setMembersLoading(false);
      }
    })();
  }

  function closeMembersModal() {
    setMembersOrg(null);
    setMembersData(null);
    setMembersError(null);
    setMembersLoading(false);
  }

  function openAssignModal(org: OrganizationItem) {
    setSuccessMessage(null);
    setAssignOrg(org);
    setAssignMode('existing');
    setAdminEmail('');
    setAdminName('');
    setAdminPassword('');
    setAdminEmailError('');
    setAdminPasswordError('');
    setAssignError(null);
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
    setAssignError(null);
  }

  function clearAdminCredentials() {
    setAdminEmail('');
    setAdminName('');
    setAdminPassword('');
  }

  async function handleAssignAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (assigning || !assignOrg) return;
    setAssignError(null);

    const trimmedEmail = adminEmail.trim();
    let valid = true;

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setAdminEmailError('Please enter a valid email address');
      valid = false;
    } else {
      setAdminEmailError('');
    }

    if (assignMode === 'new') {
      if (!adminPassword || adminPassword.length < 8) {
        setAdminPasswordError('Password must be at least 8 characters');
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
        setAssignError(getAssignAdminErrorMessage(resBody?.error));
        return;
      }

      const adminEmailAssigned = resBody.data.user.email;
      setAssignOrg(null);
      setSuccessMessage(
        `Organization admin ${adminEmailAssigned} assigned to "${assignOrg.name}".`
      );
      await load();
    } catch {
      clearAdminCredentials();
      setAssignError('Could not reach the API. Please try again.');
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
        setStatusError(getOrganizationStatusErrorMessage(body?.error));
        setStatusAction(null);
        return;
      }

      setStatusAction(null);
      setSuccessMessage(
        next === 'SUSPENDED'
          ? `Organization "${body.data.name}" was suspended.`
          : `Organization "${body.data.name}" was activated.`
      );
      await load();
    } catch {
      setStatusError('Could not reach the API. Please try again.');
      setStatusAction(null);
    } finally {
      setStatusUpdating(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreateError(null);

    const trimmedName = newName.trim();
    if (!trimmedName) {
      setNameError('Organization name is required');
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
        setCreateError(getCreateOrganizationErrorMessage(body?.error));
        return;
      }

      setShowCreateModal(false);
      setNewName('');
      setNameError('');
      setSuccessMessage(`Organization "${body.data.name}" was created.`);
      await load();
    } catch {
      setCreateError('Could not reach the API. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !editingOrg) return;
    setEditError(null);

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditNameError('Organization name is required');
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
        setEditError(getEditOrganizationErrorMessage(body?.error));
        return;
      }

      const updatedName = body.data.name;
      setEditingOrg(null);
      setEditName('');
      setEditNameError('');
      setSuccessMessage(`Organization "${updatedName}" was updated.`);
      await load();
    } catch {
      setEditError('Could not reach the API. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const activeCount = organizations?.filter((org) => org.status === 'ACTIVE').length ?? 0;
  const suspendedCount = organizations?.filter((org) => org.status === 'SUSPENDED').length ?? 0;
  const totalOrganizations = meta?.total ?? organizations?.length ?? 0;

  if (loading && organizations === null && !error) {
    return (
      <DashboardLayout navLabel="Platform Admin" items={platformAdminNav}>
        <div className="mx-auto flex max-w-5xl items-center gap-3 text-neutral-700">
          <Spinner size="lg" label="Loading organizations..." />
          <span>Loading organizations...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navLabel="Platform Admin" items={platformAdminNav}>
      <div className="mx-auto max-w-5xl">
        <PageHeader
          subtitle="Platform Admin"
          title="Organizations"
          description={meta ? `${meta.total} organization${meta.total === 1 ? '' : 's'}` : undefined}
          actions={
            <>
              <a
                href="/dashboard"
                className="text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                Back to dashboard
              </a>
              <Button size="sm" onClick={() => setShowCreateModal(true)}>
                Create Organization
              </Button>
            </>
          }
        />

        {successMessage ? (
          <div className="mb-6">
            <Alert variant="success" onDismiss={() => setSuccessMessage(null)}>
              {successMessage}
            </Alert>
          </div>
        ) : null}

        {statusError ? (
          <div className="mb-6">
            <Alert variant="error" onDismiss={() => setStatusError(null)}>
              {statusError}
            </Alert>
          </div>
        ) : null}

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
            <TableCard>
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className={tableHeadClass}>Name</th>
                    <th className={tableHeadClass}>Status</th>
                    <th className={tableHeadClass}>Admins</th>
                    <th className={tableHeadClass}>Members</th>
                    <th className={tableHeadClass}>Created</th>
                    <th className={tableHeadClass}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {organizations.map((org) => (
                    <tr key={org.id} className={tableRowHoverClass}>
                      <td className={tableCellClass}>
                        <p className="font-medium text-neutral-900">{org.name}</p>
                        <p className="text-sm text-neutral-500">{org.slug}</p>
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
                                <p className="text-sm font-medium text-neutral-900">{admin.name ?? '—'}</p>
                                <p className="text-xs text-neutral-500">{admin.email}</p>
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
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="secondary" size="sm" onClick={() => openMembersModal(org)}>
                            Members
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openAssignModal(org)}>
                            Assign Admin
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEditModal(org)}>
                            Edit
                          </Button>
                          {org.status === 'ACTIVE' ? (
                            <Button variant="danger" size="sm" onClick={() => requestStatusChange(org)}>
                              Suspend
                            </Button>
                          ) : (
                            <Button variant="secondary" size="sm" onClick={() => requestStatusChange(org)}>
                              Activate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableCard>
          </>
        ) : null}
      </div>

      <Modal isOpen={showCreateModal} onClose={closeCreateModal} title="Create Organization" closeOnOverlayClick={!creating}>
        <form onSubmit={handleCreate} noValidate>
          <div className="space-y-4">
            {createError ? <FormError message={createError} /> : null}

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
            {editError ? <FormError message={editError} /> : null}

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
        {membersError ? (
          <FormError message={membersError} />
        ) : membersLoading ? (
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
            {assignError ? <FormError message={assignError} /> : null}

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
    </DashboardLayout>
  );
}
