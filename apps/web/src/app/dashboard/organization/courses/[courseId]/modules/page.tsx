'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge, Button, EmptyState, EmptyStateIcons, Spinner } from '../../../../../../components/ui';
import { FormError } from '../../../../../../components/forms/FormError';
import { Input } from '../../../../../../components/ui/Input';
import { LinkButton } from '../../../../../../components/ui/LinkButton';
import { Modal } from '../../../../../../components/ui/Modal';
import { getModuleErrorMessage } from '../../../../../../features/course/moduleErrors';

type MeResponse = {
  user?: {
    id?: string;
    name?: string | null;
    email?: string;
    emailVerified?: boolean;
    role?: string | null;
    organizationId?: string | null;
  };
};

type ModuleListItem = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

type ListModulesResponse = {
  success?: boolean;
  data?: ModuleListItem[];
  error?: string;
};

type CreateModuleResponse = {
  success?: boolean;
  data?: ModuleListItem;
  error?: string;
};

type UpdateModuleResponse = {
  success?: boolean;
  data?: ModuleListItem;
  error?: string;
};

type DeleteModuleResponse = {
  success?: boolean;
  error?: string;
};

export default function CourseModulesPage() {
  const params = useParams();
  const courseId = typeof params.courseId === 'string' ? params.courseId : null;
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [modules, setModules] = useState<ModuleListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingModule, setEditingModule] = useState<ModuleListItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState('');
  const [titleError, setTitleError] = useState('');
  const [orderError, setOrderError] = useState('');

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
        const role = meData.user?.role;
        if (role !== 'ORG_ADMIN' && role !== 'INSTRUCTOR') {
          window.location.href = '/login';
          return;
        }
        const orgId = meData.user?.organizationId ?? null;
        if (!orgId) {
          window.location.href = '/login';
          return;
        }
        setOrganizationId(orgId);
      } catch {
        if (active) window.location.href = '/login';
      } finally {
        if (active) setCheckingAuth(false);
      }
    }

    guard();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!organizationId || !courseId) return;
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        const res = await fetch(
          `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules`,
          { credentials: 'include' }
        );
        if (!active) return;
        if (!res.ok) {
          let code: unknown = null;
          try {
            code = (await res.json())?.error;
          } catch {
            code = null;
          }
          setError(getModuleErrorMessage(code));
          return;
        }
        const body: ListModulesResponse = await res.json();
        if (!active) return;
        setModules(body.data ?? []);
      } catch {
        if (active) setError(getModuleErrorMessage(null));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [organizationId, courseId]);

  function closeCreateModal() {
    if (creating) return;
    setShowCreateModal(false);
    setTitle('');
    setDescription('');
    setOrder('');
    setTitleError('');
    setOrderError('');
  }

  function closeEditModal() {
    if (updating) return;
    setShowEditModal(false);
    setEditingModule(null);
    setTitle('');
    setDescription('');
    setOrder('');
    setTitleError('');
    setOrderError('');
  }

  function validateForm(): boolean {
    setTitleError('');
    setOrderError('');
    let isValid = true;

    if (!title.trim()) {
      setTitleError('Title is required');
      isValid = false;
    }

    const parsedOrder = parseInt(order, 10);
    if (order.trim() === '' || isNaN(parsedOrder) || parsedOrder < 0 || !Number.isInteger(parsedOrder)) {
      setOrderError('Order must be a non-negative integer');
      isValid = false;
    }

    return isValid;
  }

  async function handleCreate() {
    if (!validateForm()) return;
    if (!organizationId || !courseId) return;

    setCreating(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            order: parseInt(order, 10),
          }),
        }
      );

      if (!res.ok) {
        let code: unknown = null;
        try {
          code = (await res.json())?.error;
        } catch {
          code = null;
        }
        if (code === 'MODULE_ORDER_TAKEN') {
          setOrderError(getModuleErrorMessage(code));
        } else {
          setError(getModuleErrorMessage(code));
        }
        return;
      }

      closeCreateModal();
      router.refresh();
    } catch {
      setError(getModuleErrorMessage(null));
    } finally {
      setCreating(false);
    }
  }

  function openEditModal(module: ModuleListItem) {
    setEditingModule(module);
    setTitle(module.title);
    setDescription(module.description ?? '');
    setOrder(String(module.order));
    setShowEditModal(true);
  }

  async function handleUpdate() {
    if (!validateForm()) return;
    if (!organizationId || !courseId || !editingModule) return;

    setUpdating(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${editingModule.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            order: parseInt(order, 10),
          }),
        }
      );

      if (!res.ok) {
        let code: unknown = null;
        try {
          code = (await res.json())?.error;
        } catch {
          code = null;
        }
        if (code === 'MODULE_ORDER_TAKEN') {
          setOrderError(getModuleErrorMessage(code));
        } else {
          setError(getModuleErrorMessage(code));
        }
        return;
      }

      closeEditModal();
      router.refresh();
    } catch {
      setError(getModuleErrorMessage(null));
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete(moduleId: string) {
    if (!confirm('Are you sure you want to delete this module?')) return;
    if (!organizationId || !courseId) return;

    setDeleting(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (!res.ok) {
        let code: unknown = null;
        try {
          code = (await res.json())?.error;
        } catch {
          code = null;
        }
        setError(getModuleErrorMessage(code));
        return;
      }

      router.refresh();
    } catch {
      setError(getModuleErrorMessage(null));
    } finally {
      setDeleting(false);
    }
  }

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto flex max-w-3xl items-center gap-3 text-neutral-700">
          <Spinner size="lg" label="Loading..." />
          <span>Loading...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Course Modules</p>
          <LinkButton href={`/dashboard/organization/courses/${courseId}`} variant="ghost" size="sm">
            Back to Course
          </LinkButton>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Modules</h1>
              <p className="mt-1 text-sm text-neutral-500">
                Manage modules for this course.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              Create Module
            </Button>
          </div>

          {error ? (
            <div className="mt-6">
              <FormError message={error} />
            </div>
          ) : null}

          {loading ? (
            <div className="mt-8 flex items-center gap-3 text-neutral-700">
              <Spinner size="md" label="Loading modules..." />
              <span>Loading modules...</span>
            </div>
          ) : modules !== null && modules.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                icon={EmptyStateIcons.NoData}
                title="No modules yet"
                description="Create your first module to start structuring your course content."
                action={{
                  label: 'Create Module',
                  onClick: () => setShowCreateModal(true),
                  variant: 'primary',
                  size: 'sm',
                }}
              />
            </div>
          ) : modules !== null && modules.length > 0 ? (
            <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 w-16">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 w-40">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 bg-white">
                  {modules.map((module) => (
                    <tr key={module.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-4 text-sm font-medium text-neutral-900">
                        <Badge variant="default" size="sm">{module.order}</Badge>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-primary-600 hover:text-primary-700">
                        {module.title}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-700 max-w-md truncate">
                        {module.description ?? '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(module)}>
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleDelete(module.id)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        title="Create Module"
        closeOnOverlayClick={!creating}
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            error={titleError}
            placeholder="e.g. Introduction to Programming"
            autoComplete="off"
            disabled={creating}
            required
          />

          <Input
            label="Description"
            value={description}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
            placeholder="Optional description"
            autoComplete="off"
            disabled={creating}
          />

          <Input
            label="Order"
            type="number"
            min="0"
            step="1"
            value={order}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrder(e.target.value)}
            error={orderError}
            placeholder="e.g. 0"
            autoComplete="off"
            disabled={creating}
            required
            helperText="Non-negative integer. Modules are displayed in ascending order."
          />

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={closeCreateModal} disabled={creating}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreate} loading={creating} disabled={creating}>
              {creating ? 'Creating...' : 'Create Module'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={closeEditModal}
        title="Edit Module"
        closeOnOverlayClick={!updating}
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            error={titleError}
            placeholder="e.g. Introduction to Programming"
            autoComplete="off"
            disabled={updating}
            required
          />

          <Input
            label="Description"
            value={description}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
            placeholder="Optional description"
            autoComplete="off"
            disabled={updating}
          />

          <Input
            label="Order"
            type="number"
            min="0"
            step="1"
            value={order}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrder(e.target.value)}
            error={orderError}
            placeholder="e.g. 0"
            autoComplete="off"
            disabled={updating}
            required
            helperText="Non-negative integer. Modules are displayed in ascending order."
          />

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={closeEditModal} disabled={updating}>
              Cancel
            </Button>
            <Button type="button" onClick={handleUpdate} loading={updating} disabled={updating}>
              {updating ? 'Updating...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}