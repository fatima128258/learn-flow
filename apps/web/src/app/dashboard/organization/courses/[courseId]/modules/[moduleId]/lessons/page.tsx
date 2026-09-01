'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge, Button, EmptyState, EmptyStateIcons, Spinner } from '../../../../../../../../components/ui';
import { Input } from '../../../../../../../../components/ui/Input';
import { Textarea } from '../../../../../../../../components/forms/Textarea';
import { LinkButton } from '../../../../../../../../components/ui/LinkButton';
import { Modal } from '../../../../../../../../components/ui/Modal';
import { getLessonErrorMessage } from '../../../../../../../../features/course/lessonErrors';
import { useToast } from '../../../../../../../../components/ui/ToastProvider';

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

type LessonListItem = {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  duration: number | null;
  order: number;
  isPreview: boolean;
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
  const toast = useToast();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [lessons, setLessons] = useState<LessonListItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LessonDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('');
  const [duration, setDuration] = useState('');
  const [order, setOrder] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const [titleError, setTitleError] = useState('');
  const [orderError, setOrderError] = useState('');
  const [durationError, setDurationError] = useState('');

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
    if (!organizationId || !courseId || !moduleId) return;
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
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

  function clearForm() {
    setTitle('');
    setDescription('');
    setContent('');
    setType('');
    setDuration('');
    setOrder('');
    setIsPreview(false);
    setTitleError('');
    setOrderError('');
    setDurationError('');
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
    setDurationError('');

    if (!title.trim()) {
      setTitleError('Title is required');
      return 'Title is required';
    }

    const parsedOrder = parseInt(order, 10);
    if (order.trim() === '' || isNaN(parsedOrder) || parsedOrder < 0 || !Number.isInteger(parsedOrder)) {
      setOrderError('Order must be a non-negative integer');
      return 'Order must be a non-negative integer';
    }

    if (duration.trim() !== '') {
      const parsedDuration = parseInt(duration, 10);
      if (isNaN(parsedDuration) || parsedDuration < 0 || !Number.isInteger(parsedDuration)) {
        setDurationError('Duration must be a non-negative integer');
        return 'Duration must be a non-negative integer';
      }
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
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const body: Record<string, unknown> = {
        title: title.trim(),
        order: parseInt(order, 10),
      };
      if (description.trim()) body.description = description.trim();
      if (content.trim()) body.content = content.trim();
      if (type.trim()) body.type = type.trim();
      if (duration.trim() !== '') body.duration = parseInt(duration, 10);
      if (isPreview) body.isPreview = true;

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
      router.refresh();
    } catch {
      toast.error(getLessonErrorMessage(null));
    } finally {
      setCreating(false);
    }
  }

  async function openEditModal(lesson: LessonListItem) {
    if (!organizationId || !courseId || !moduleId) return;

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
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
      setDescription(detail.description ?? '');
      setContent(detail.content ?? '');
      setType(detail.type ?? '');
      setDuration(detail.duration != null ? String(detail.duration) : '');
      setOrder(String(detail.order));
      setIsPreview(detail.isPreview);
      setShowEditModal(true);
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
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const body: Record<string, unknown> = {
        title: title.trim(),
        order: parseInt(order, 10),
      };
      if (description.trim()) body.description = description.trim();
      else body.description = null;
      if (content.trim()) body.content = content.trim();
      else body.content = null;
      if (type.trim()) body.type = type.trim();
      else body.type = null;
      if (duration.trim() !== '') body.duration = parseInt(duration, 10);
      else body.duration = null;
      body.isPreview = isPreview;

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
      router.refresh();
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
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
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
      router.refresh();
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
          <LinkButton href={`/dashboard/organization/courses/${courseId}/modules${organizationId ? `?organization=${organizationId}` : ''}`} variant="ghost" size="sm">
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
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              Create Lesson
            </Button>
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
          ) : lessons !== null && lessons.length > 0 ? (
            <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 w-16">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 w-24">Duration</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 w-20">Preview</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 w-40">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 bg-white">
                  {lessons.map((lesson) => (
                    <tr key={lesson.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-4 text-sm font-medium text-neutral-900">
                        <Badge variant="default" size="sm">{lesson.order}</Badge>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-primary-600 hover:text-primary-700">
                        {lesson.title}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-700 max-w-md truncate">
                        {lesson.description ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-700">
                        {lesson.duration != null ? `${lesson.duration}m` : '—'}
                      </td>
                      <td className="px-6 py-4">
                        {lesson.isPreview ? (
                          <Badge variant="info" size="sm">Yes</Badge>
                        ) : (
                          <span className="text-sm text-neutral-400">No</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(lesson)}>
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleDelete(lesson.id)}>
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
            label="Description"
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            placeholder="Optional description"
            autoComplete="off"
            disabled={creating}
            rows={2}
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

          <Input
            label="Type"
            value={type}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setType(e.target.value)}
            placeholder="e.g. video, reading, quiz"
            autoComplete="off"
            disabled={creating}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Duration (minutes)"
              type="number"
              min="0"
              step="1"
              value={duration}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDuration(e.target.value)}
              error={durationError}
              placeholder="e.g. 15"
              autoComplete="off"
              disabled={creating}
              helperText="Non-negative integer."
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

          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={isPreview}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsPreview(e.target.checked)}
              disabled={creating}
              className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            Preview lesson (visible to unenrolled users)
          </label>

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
            label="Description"
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            placeholder="Optional description"
            autoComplete="off"
            disabled={updating}
            rows={2}
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

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Duration (minutes)"
              type="number"
              min="0"
              step="1"
              value={duration}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDuration(e.target.value)}
              error={durationError}
              placeholder="e.g. 15"
              autoComplete="off"
              disabled={updating}
              helperText="Non-negative integer."
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
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={isPreview}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsPreview(e.target.checked)}
              disabled={updating}
              className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            Preview lesson (visible to unenrolled users)
          </label>

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
