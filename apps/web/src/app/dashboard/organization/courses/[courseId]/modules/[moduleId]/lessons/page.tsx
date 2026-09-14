'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Badge, Button, Drawer, EmptyState, EmptyStateIcons, Spinner } from '../../../../../../../../components/ui';
import { Input } from '../../../../../../../../components/ui/Input';
import { Textarea } from '../../../../../../../../components/forms/Textarea';
import { LinkButton } from '../../../../../../../../components/ui/LinkButton';
import { Modal } from '../../../../../../../../components/ui/Modal';
import { getLessonErrorMessage } from '../../../../../../../../features/course/lessonErrors';
import { useToast } from '../../../../../../../../components/ui/ToastProvider';

import { useCurrentUser } from '../../../../../../../../features/auth/useCurrentUser';
import { ViewToggle, DataViewMode } from '../../../../../../../../components/ui/ViewToggle';

// 3-dot menu component for lessons
function LessonActionsMenu({ lesson, onEdit, onDelete }: {
  lesson: { id: string; title: string };
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

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

  function toggleMenu() {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 192;
      const menuHeight = 96;
      const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
      const top = rect.bottom + menuHeight <= window.innerHeight
        ? rect.bottom + 4
        : rect.top - menuHeight - 4;
      setMenuPosition({ top, left });
    }
    setIsOpen(!isOpen);
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className="inline-flex items-center justify-center rounded-lg border-0 p-1 text-neutral-500 transition-colors hover:bg-neutral-100 focus:border-0 focus:outline-none focus-visible:border-0 focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
        aria-label="Lesson actions"
      >
        <svg className="w-5 h-5 text-neutral-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 8c1.1 0 2-0.9 2-2s-0.9-2-2-2-2 0.9-2 2 0.9 2 2 2zm0 2c-1.1 0-2 0.9-2 2s0.9 2 2 2 2-0.9 2-2-0.9-2-2-2zm0 6c-1.1 0-2 0.9-2 2s0.9 2 2 2 2-0.9 2-2-0.9-2-2-2z" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left, zIndex: 9999 }}
          className="w-48 rounded-lg border border-neutral-200 bg-white shadow-lg"
        >
          <button
            onClick={() => {
              onEdit();
              setIsOpen(false);
            }}
            className="w-full border-0 text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 border-b border-neutral-100 first:rounded-t-lg focus:border-0 focus:outline-none focus-visible:border-0 focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
          >
            ✏️ Edit
          </button>
          <button
            onClick={() => {
              onDelete();
              setIsOpen(false);
            }}
            className="w-full border-0 text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-b-lg focus:border-0 focus:outline-none focus-visible:border-0 focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
          >
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
  );
}

type LessonListItem = {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  duration: number | null;
  order: number;
  createdAt: string;
};

type LessonDetail = LessonListItem & {
  moduleId: string;
  content: string | null;
  updatedAt: string;
};

type ListLessonsResponse = {
  success?: boolean;
  data?: LessonListItem[];
  error?: string;
};

type LessonApiResponse = {
  success?: boolean;
  data?: LessonDetail;
  error?: string;
};

type DeleteLessonResponse = {
  success?: boolean;
  error?: string;
};

export default function ModuleLessonsPage() {
  const params = useParams();
  const courseId = typeof params.courseId === 'string' ? params.courseId : null;
  const moduleId = typeof params.moduleId === 'string' ? params.moduleId : null;
  const router = useRouter();
  const pathname = usePathname();
  const dashboardPrefix = pathname.startsWith('/dashboard/instructor') ? '/dashboard/instructor' : '/dashboard/organization';
  const toast = useToast();
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [lessons, setLessons] = useState<LessonListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<DataViewMode>('table');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LessonDetail | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<LessonDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('');
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
    if (!organizationId || !courseId || !moduleId) return;
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const apiBase = '';
        const res = await fetch(
          `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/lessons`,
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
          toast.error(getLessonErrorMessage(code));
          return;
        }
        const body: ListLessonsResponse = await res.json();
        if (!active) return;
        setLessons(body.data ?? []);
      } catch {
        if (active) toast.error(getLessonErrorMessage(null));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [organizationId, courseId, moduleId, toast]);

  async function reloadLessons() {
    if (!organizationId || !courseId || !moduleId) return;
    setLoading(true);
    try {
      const apiBase = '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/lessons`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const body: ListLessonsResponse = await res.json();
        setLessons(body.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  function clearForm() {
    setTitle('');
    setContent('');
    setType('');
    setOrder('');
    setTitleError('');
    setOrderError('');
  }

  function closeCreateModal() {
    if (creating) return;
    setShowCreateModal(false);
    clearForm();
  }

  function closeEditModal() {
    if (updating) return;
    setShowEditModal(false);
    setEditingLesson(null);
    clearForm();
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
    if (!organizationId || !courseId || !moduleId) return;

    setCreating(true);
    try {
      const apiBase = '';
      const body: Record<string, unknown> = {
        title: title.trim(),
        order: parseInt(order, 10),
      };
      if (content.trim()) body.content = content.trim();
      if (type.trim()) body.type = type.trim();

      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/lessons`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        let code: unknown = null;
        try {
          code = (await res.json())?.error;
        } catch {
          code = null;
        }
        if (code === 'LESSON_ORDER_TAKEN') {
          setOrderError(getLessonErrorMessage(code));
        } else {
          toast.error(getLessonErrorMessage(code));
        }
        return;
      }

      toast.success('Lesson created successfully.');
      closeCreateModal();
      await reloadLessons();
    } catch {
      toast.error(getLessonErrorMessage(null));
    } finally {
      setCreating(false);
    }
  }

  async function openEditModal(lesson: LessonListItem) {
    if (!organizationId || !courseId || !moduleId) return;

    try {
      const apiBase = '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/lessons/${lesson.id}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        let code: unknown = null;
        try {
          code = (await res.json())?.error;
        } catch {
          code = null;
        }

        toast.error(getLessonErrorMessage(code));
        return;
      }

      const body: LessonApiResponse = await res.json();
      const detail = body.data;
      if (!detail) return;

      setEditingLesson(detail);
      setTitle(detail.title);
      setContent(detail.content ?? '');
      setType(detail.type ?? '');
      setOrder(String(detail.order));
      setShowEditModal(true);
    } catch {
      toast.error(getLessonErrorMessage(null));
    }
  }

  async function openLessonDetails(lesson: LessonListItem) {
    if (!organizationId || !courseId || !moduleId) return;
    try {
      const res = await fetch(
        `/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/lessons/${lesson.id}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        const body: LessonApiResponse = await res.json().catch(() => ({}));
        toast.error(getLessonErrorMessage(body.error));
        return;
      }
      const body: LessonApiResponse = await res.json();
      if (body.data) setSelectedLesson(body.data);
    } catch {
      toast.error(getLessonErrorMessage(null));
    }
  }

  async function handleUpdate() {
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!organizationId || !courseId || !moduleId || !editingLesson) return;

    setUpdating(true);
    try {
      const apiBase = '';
      const body: Record<string, unknown> = {
        title: title.trim(),
        order: parseInt(order, 10),
      };
      if (content.trim()) body.content = content.trim();
      else body.content = null;
      if (type.trim()) body.type = type.trim();
      else body.type = null;

      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/lessons/${editingLesson.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        let code: unknown = null;
        try {
          code = (await res.json())?.error;
        } catch {
          code = null;
        }
        if (code === 'LESSON_ORDER_TAKEN') {
          setOrderError(getLessonErrorMessage(code));
        } else {
          toast.error(getLessonErrorMessage(code));
        }
        return;
      }

      toast.success('Lesson updated successfully.');
      closeEditModal();
      await reloadLessons();
    } catch {
      toast.error(getLessonErrorMessage(null));
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete(lessonId: string) {
    if (!confirm('Are you sure you want to delete this lesson?')) return;
    if (!organizationId || !courseId || !moduleId) return;

    try {
      const apiBase = '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`,
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
        toast.error(getLessonErrorMessage(code));
        return;
      }

      toast.success('Lesson deleted successfully.');
      await reloadLessons();
    } catch {
      toast.error(getLessonErrorMessage(null));
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
          <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Module Lessons</p>
          <LinkButton href={`${dashboardPrefix}/courses/${courseId}/modules${organizationId ? `?organization=${organizationId}` : ''}`} variant="ghost" size="sm">
            Back to Modules
          </LinkButton>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Lessons</h1>
              <p className="mt-1 text-sm text-neutral-500">
                Manage lessons for this module.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button size="sm" className="h-10" onClick={() => setShowCreateModal(true)}>
                Create Lesson
              </Button>
              <ViewToggle value={viewMode} onChange={setViewMode} storageKey="module-lessons-view" />
            </div>
          </div>

          {loading ? (
            <div className="mt-8 flex items-center gap-3 text-neutral-700">
              <Spinner size="md" label="Loading lessons..." />
              <span>Loading lessons...</span>
            </div>
          ) : lessons !== null && lessons.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                icon={EmptyStateIcons.NoData}
                title="No lessons yet"
                description="Create your first lesson to start adding content to this module."
                action={{
                  label: 'Create Lesson',
                  onClick: () => setShowCreateModal(true),
                  variant: 'primary',
                  size: 'sm',
                }}
              />
            </div>
          ) : lessons !== null && lessons.length > 0 && viewMode === 'table' ? (
            <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-6 py-3 text-center align-middle text-xs font-semibold uppercase tracking-wide text-neutral-500 w-16">Order</th>
                    <th className="w-64 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Type</th>
                    <th className="px-6 py-3 text-center align-middle text-xs font-semibold uppercase tracking-wide text-neutral-500 w-40">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 bg-white">
                  {lessons.map((lesson) => (
                    <tr key={lesson.id} className="cursor-pointer hover:bg-neutral-50" onClick={() => void openLessonDetails(lesson)}>
                      <td className="px-6 py-4 text-center align-middle text-sm font-medium text-neutral-900">
                        <Badge variant="default" size="sm">{lesson.order}</Badge>
                      </td>
                      <td className="w-64 max-w-64 px-6 py-4 text-sm font-medium text-primary-600 hover:text-primary-700" title={lesson.title}>
                        <span className="block truncate">{lesson.title}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-700 max-w-md truncate">
                        {lesson.type || '—'}
                      </td>
                      <td className="px-6 py-4 text-center align-middle" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-center">
                          <LessonActionsMenu
                            lesson={lesson}
                            onEdit={() => openEditModal(lesson)}
                            onDelete={() => handleDelete(lesson.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          ) : lessons !== null && lessons.length > 0 && viewMode === 'cards' ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="cursor-pointer rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                  onClick={() => void openLessonDetails(lesson)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Lesson {lesson.order}</p>
                      <h2 className="mt-1 truncate text-lg font-semibold text-primary-600" title={lesson.title}>{lesson.title}</h2>
                    </div>
                    <div onClick={(event) => event.stopPropagation()}>
                      <LessonActionsMenu
                        lesson={lesson}
                        onEdit={() => openEditModal(lesson)}
                        onDelete={() => handleDelete(lesson.id)}
                      />
                    </div>
                  </div>
                  <p className="mt-4 line-clamp-3 text-sm text-neutral-600">
                    {lesson.description || 'No description available.'}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                    <span>{lesson.type || 'Lesson'}</span>
                    <span>Order {lesson.order}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <Drawer isOpen={Boolean(selectedLesson)} onClose={() => setSelectedLesson(null)} title={selectedLesson?.title ?? 'Lesson details'}>
        {selectedLesson && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-900">Title</p>
              <p className="mt-1 text-lg font-semibold text-neutral-900">{selectedLesson.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-neutral-900">Order</p><p className="mt-1 text-sm text-neutral-700">{selectedLesson.order}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-neutral-900">Duration</p><p className="mt-1 text-sm text-neutral-700">{selectedLesson.duration != null ? `${selectedLesson.duration} minutes` : '—'}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-neutral-900">Type</p><p className="mt-1 text-sm text-neutral-700">{selectedLesson.type || '—'}</p></div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-900">Description</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{selectedLesson.description || 'No description available.'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-900">Content</p>
              {selectedLesson.content ? <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-sm leading-6 text-neutral-700">{selectedLesson.content}</pre> : <p className="mt-1 text-sm text-neutral-400">No content available.</p>}
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        title="Create Lesson"
        closeOnOverlayClick={!creating}
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            error={titleError}
            placeholder="e.g. Introduction to Variables"
            autoComplete="off"
            disabled={creating}
            required
          />

          <Textarea
            label="Content"
            value={content}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
            placeholder="Optional lesson content (markdown or plain text)"
            autoComplete="off"
            disabled={creating}
            rows={4}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Type"
              value={type}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setType(e.target.value)}
              placeholder="e.g. video, reading, quiz"
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
              helperText="Non-negative integer."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={closeCreateModal} disabled={creating}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreate} loading={creating} disabled={creating}>
              {creating ? 'Creating...' : 'Create Lesson'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={closeEditModal}
        title="Edit Lesson"
        closeOnOverlayClick={!updating}
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            error={titleError}
            placeholder="e.g. Introduction to Variables"
            autoComplete="off"
            disabled={updating}
            required
          />

          <Textarea
            label="Content"
            value={content}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
            placeholder="Optional lesson content (markdown or plain text)"
            autoComplete="off"
            disabled={updating}
            rows={4}
          />

          <Input
            label="Type"
            value={type}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setType(e.target.value)}
            placeholder="e.g. video, reading, quiz"
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
            helperText="Non-negative integer."
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
    </div>
  );
}
