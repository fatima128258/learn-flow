'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge, Button, EmptyState, EmptyStateIcons, Spinner, Drawer } from '../../../../../../components/ui';
import { Input } from '../../../../../../components/ui/Input';
import { LinkButton } from '../../../../../../components/ui/LinkButton';
import { Modal } from '../../../../../../components/ui/Modal';
import Link from 'next/link';
import { getModuleErrorMessage } from '../../../../../../features/course/moduleErrors';
import { useToast } from '../../../../../../components/ui/ToastProvider';
import { useCurrentUser } from '../../../../../../features/auth/useCurrentUser';

// 3-dot menu component
function ModuleActionsMenu({ module, courseId, organizationId, onEdit, onDelete }: {
  module: { id: string; title: string };
  courseId: string;
  organizationId: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 hover:bg-neutral-100 rounded-md transition-colors"
        aria-label="Module actions"
      >
        <svg className="w-5 h-5 text-neutral-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 8c1.1 0 2-0.9 2-2s-0.9-2-2-2-2 0.9-2 2 0.9 2 2 2zm0 2c-1.1 0-2 0.9-2 2s0.9 2 2 2 2-0.9 2-2-0.9-2-2-2zm0 6c-1.1 0-2 0.9-2 2s0.9 2 2 2 2-0.9 2-2-0.9-2-2-2z" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed bg-white rounded-lg border border-neutral-200 shadow-lg z-50 w-48">
          <Link
            href={`/dashboard/organization/courses/${courseId}/modules/${module.id}/lessons${organizationId ? `?organization=${organizationId}` : ''}`}
            className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 border-b border-neutral-100 first:rounded-t-lg"
            onClick={() => setIsOpen(false)}
          >
            📚 Add Lesson
          </Link>
          <Link
            href={`/dashboard/organization/courses/${courseId}/modules/${module.id}/quizzes${organizationId ? `?organization=${organizationId}` : ''}`}
            className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 border-b border-neutral-100"
            onClick={() => setIsOpen(false)}
          >
            ❓ Add Quiz
          </Link>
          <button
            onClick={() => {
              onEdit();
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 border-b border-neutral-100"
          >
            ✏️ Edit
          </button>
          <button
            onClick={() => {
              onDelete();
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-b-lg"
          >
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
  );
}

// Module Details Drawer component
function ModuleDetailsDrawer({ module, isOpen, onClose }: {
  module: ModuleListItem | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!module) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={module.title}
    >
      <div className="space-y-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Order</p>
          <div className="mt-1">
            <Badge variant="default" size="sm">{module.order}</Badge>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Title</p>
          <p className="mt-1 text-sm font-medium text-neutral-900">{module.title}</p>
        </div>

        {module.description && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Description</p>
            <p className="mt-1 text-sm text-neutral-700 whitespace-pre-wrap break-words">{module.description}</p>
          </div>
        )}

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Created</p>
          <p className="mt-1 text-sm text-neutral-700">{new Date(module.createdAt).toLocaleString()}</p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Last Updated</p>
          <p className="mt-1 text-sm text-neutral-700">{new Date(module.updatedAt).toLocaleString()}</p>
        </div>
      </div>
    </Drawer>
  );
}

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
  const toast = useToast();
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [modules, setModules] = useState<ModuleListItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingModule, setEditingModule] = useState<ModuleListItem | null>(null);
  const [selectedModule, setSelectedModule] = useState<ModuleListItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState('');
  const [titleError, setTitleError] = useState('');
  const [orderError, setOrderError] = useState('');

  // Check auth and set organizationId
  useEffect(() => {
    if (userLoading) return;

    const role = user?.role;
    if (role !== 'ORG_ADMIN' && role !== 'INSTRUCTOR') {
      window.location.href = '/login';
      return;
    }

    const orgId = user?.organizationId ?? null;
    if (!orgId) {
      window.location.href = '/login';
      return;
    }

    setOrganizationId(orgId);
    setCheckingAuth(false);
  }, [user, userLoading]);

  useEffect(() => {
    if (!organizationId || !courseId) return;
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const apiBase = '';
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
          toast.error(getModuleErrorMessage(code));
          return;
        }
        const body: ListModulesResponse = await res.json();
        if (!active) return;
        setModules(body.data ?? []);
      } catch {
        if (active) toast.error(getModuleErrorMessage(null));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [organizationId, courseId, toast]);

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

  function validateForm(): string | null {
    setTitleError('');
    setOrderError('');

    if (!title.trim()) {
      setTitleError('Title is required');
      return 'Title is required';
    }

    const parsedOrder = parseInt(order, 10);
    if (order.trim() === '' || isNaN(parsedOrder) || parsedOrder < 0 || !Number.isInteger(parsedOrder)) {
      setOrderError('Order must be a non-negative integer');
      return 'Order must be a non-negative integer';
    }

    return null;
  }

  async function handleCreate() {
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!organizationId || !courseId) return;

    setCreating(true);
    try {
      const apiBase = '';
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
          toast.error(getModuleErrorMessage(code));
        }
        return;
      }

      const body: CreateModuleResponse = await res.json();
      if (body.data) {
        setModules((prev) => prev ? [...prev, body.data!] : [body.data!]);
      }

      toast.success('Module created.');
      closeCreateModal();
      router.refresh();
    } catch {
      toast.error(getModuleErrorMessage(null));
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
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!organizationId || !courseId || !editingModule) return;

    setUpdating(true);
    try {
      const apiBase = '';
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
          toast.error(getModuleErrorMessage(code));
        }
        return;
      }

      const body: UpdateModuleResponse = await res.json();
      if (body.data) {
        setModules((prev) =>
          prev ? prev.map((m) => (m.id === editingModule.id ? body.data! : m)) : null
        );
      }

      toast.success('Module updated.');
      closeEditModal();
      router.refresh();
    } catch {
      toast.error(getModuleErrorMessage(null));
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete(moduleId: string) {
    if (!confirm('Are you sure you want to delete this module?')) return;
    if (!organizationId || !courseId) return;

    setDeleting(true);
    try {
      const apiBase = '';
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
        toast.error(getModuleErrorMessage(code));
        return;
      }

      setModules((prev) => prev ? prev.filter((m) => m.id !== moduleId) : null);
      toast.success('Module deleted.');
      router.refresh();
    } catch {
      toast.error(getModuleErrorMessage(null));
    } finally {
      setDeleting(false);
    }
  }

  if (checkingAuth) {
    return (
      <div>
        <div className="mx-auto flex max-w-3xl items-center gap-3 text-neutral-700">
          <Spinner size="lg" label="Loading..." />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Course Modules</p>
          <LinkButton href={`/dashboard/organization/courses/${courseId}${organizationId ? `?organization=${organizationId}` : ''}`} variant="ghost" size="sm">
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
            <div className="mt-6">
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-2xl border border-neutral-200 md:block">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 w-16">Order</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 bg-white">
                    {modules.map((module) => (
                      <tr key={module.id} className="hover:bg-neutral-50 cursor-pointer" onClick={() => setSelectedModule(module)}>
                        <td className="px-6 py-4 text-sm font-medium text-neutral-900">
                          <Badge variant="default" size="sm">{module.order}</Badge>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-primary-600 hover:text-primary-700">{module.title}</td>
                        <td className="px-6 py-4 text-sm text-neutral-700 max-w-xs truncate" title={module.description ?? ''}>{module.description ?? '—'}</td>
                        <td className="px-6 py-4 relative pl-2" onClick={(e) => e.stopPropagation()}>
                          <ModuleActionsMenu
                            module={module}
                            courseId={courseId!}
                            organizationId={organizationId!}
                            onEdit={() => openEditModal(module)}
                            onDelete={() => handleDelete(module.id)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {modules.map((module) => (
                  <div key={module.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-neutral-900 leading-snug">{module.title}</p>
                      <Badge variant="default" size="sm">#{module.order}</Badge>
                    </div>
                    {module.description && (
                      <p className="mt-1 text-sm text-neutral-500">{module.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
                      <Link href={`/dashboard/organization/courses/${courseId}/modules/${module.id}/lessons${organizationId ? `?organization=${organizationId}` : ''}`} className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors">Lessons</Link>
                      <Link href={`/dashboard/organization/courses/${courseId}/modules/${module.id}/quizzes${organizationId ? `?organization=${organizationId}` : ''}`} className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors">Quizzes</Link>
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(module)}>Edit</Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(module.id)}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
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

      <ModuleDetailsDrawer
        module={selectedModule}
        isOpen={selectedModule !== null}
        onClose={() => setSelectedModule(null)}
      />
    </div>
  );
}