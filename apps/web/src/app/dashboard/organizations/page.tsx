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
import { FormError } from '../../../components/forms/FormError';

type OrganizationItem = {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
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

type MeResponse = {
  user?: { role?: string | null };
};

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  if (loading && organizations === null && !error) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto flex max-w-5xl items-center gap-3 text-neutral-700">
          <Spinner size="lg" label="Loading organizations..." />
          <span>Loading organizations...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Platform Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-neutral-900">Organizations</h1>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-neutral-600">
              {meta ? `${meta.total} organization${meta.total === 1 ? '' : 's'}` : ''}
            </p>
            <div className="flex items-center gap-4">
              <Button size="sm" onClick={() => setShowCreateModal(true)}>
                Create Organization
              </Button>
              <a
                href="/dashboard"
                className="text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                Back to dashboard
              </a>
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
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Members</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {organizations.map((org) => (
                  <tr key={org.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-neutral-900">{org.name}</p>
                      <p className="text-sm text-neutral-500">{org.slug}</p>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={org.status === 'ACTIVE' ? 'success' : 'error'} size="sm">
                        {org.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-700">
                      {typeof org.memberCount === 'number' ? org.memberCount : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-700">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
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
          </div>
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
    </main>
  );
}
