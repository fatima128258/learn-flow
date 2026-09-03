'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge, Button, EmptyState, EmptyStateIcons, Spinner } from '../../../../../../../../components/ui';
import { Input } from '../../../../../../../../components/ui/Input';
import { Textarea } from '../../../../../../../../components/forms/Textarea';
import { LinkButton } from '../../../../../../../../components/ui/LinkButton';
import { Modal } from '../../../../../../../../components/ui/Modal';
import Link from 'next/link';
import { getQuizErrorMessage } from '../../../../../../../../features/course/quizErrors';
import { useToast } from '../../../../../../../../components/ui/ToastProvider';

import { useCurrentUser } from '../../../../../../../../features/auth/useCurrentUser';

// 3-dot menu component for quizzes
function QuizActionsMenu({ quiz, courseId, moduleId, onEdit, onDelete }: {
  quiz: { id: string; title: string };
  courseId: string;
  moduleId: string;
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
        aria-label="Quiz actions"
      >
        <svg className="w-5 h-5 text-neutral-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 8c1.1 0 2-0.9 2-2s-0.9-2-2-2-2 0.9-2 2 0.9 2 2 2zm0 2c-1.1 0-2 0.9-2 2s0.9 2 2 2 2-0.9 2-2-0.9-2-2-2zm0 6c-1.1 0-2 0.9-2 2s0.9 2 2 2 2-0.9 2-2-0.9-2-2-2z" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed bg-white rounded-lg border border-neutral-200 shadow-lg z-50 w-48">
          <Link
            href={`/dashboard/organization/courses/${courseId}/modules/${moduleId}/quizzes/${quiz.id}/questions`}
            className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 border-b border-neutral-100 first:rounded-t-lg"
            onClick={() => setIsOpen(false)}
          >
            ❓ Questions
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

type QuizListItem = {
  id: string;
  title: string;
  description: string | null;
  timeLimitMinutes: number | null;
  passingPercentage: number | null;
  maxAttempts: number | null;
  order: number;
  createdAt: string;
};

type QuizDetail = QuizListItem & {
  moduleId: string;
  updatedAt: string;
};

type ListQuizzesResponse = {
  success?: boolean;
  data?: QuizListItem[];
  error?: string;
};

type QuizApiResponse = {
  success?: boolean;
  data?: QuizDetail;
  error?: string;
};

type DeleteQuizResponse = {
  success?: boolean;
  error?: string;
};

export default function ModuleQuizzesPage() {
  const params = useParams();
  const courseId = typeof params.courseId === 'string' ? params.courseId : null;
  const moduleId = typeof params.moduleId === 'string' ? params.moduleId : null;
  const router = useRouter();
  const toast = useToast();
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<QuizListItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<QuizDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('');
  const [passingPercentage, setPassingPercentage] = useState('');
  const [maxAttempts, setMaxAttempts] = useState('');
  const [titleError, setTitleError] = useState('');
  const [orderError, setOrderError] = useState('');
  const [timeLimitError, setTimeLimitError] = useState('');
  const [passingPercentageError, setPassingPercentageError] = useState('');
  const [maxAttemptsError, setMaxAttemptsError] = useState('');

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
          `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes`,
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
          toast.error(getQuizErrorMessage(code));
          return;
        }
        const body: ListQuizzesResponse = await res.json();
        if (!active) return;
        setQuizzes(body.data ?? []);
      } catch {
        if (active) toast.error(getQuizErrorMessage(null));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [organizationId, courseId, moduleId, toast]);

  // Reload quiz list function
  async function reloadQuizzes() {
    if (!organizationId || !courseId || !moduleId) return;
    
    setLoading(true);
    try {
      const apiBase = '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const body: ListQuizzesResponse = await res.json();
        setQuizzes(body.data ?? []);
      }
    } catch {
      // Silently fail, user can manually refresh
    } finally {
      setLoading(false);
    }
  }

  function clearForm() {
    setTitle('');
    setDescription('');
    setOrder('');
    setTimeLimitMinutes('');
    setPassingPercentage('');
    setMaxAttempts('');
    setTitleError('');
    setOrderError('');
    setTimeLimitError('');
    setPassingPercentageError('');
    setMaxAttemptsError('');
  }

  function closeCreateModal() {
    if (creating) return;
    setShowCreateModal(false);
    clearForm();
  }

  function closeEditModal() {
    if (updating) return;
    setShowEditModal(false);
    setEditingQuiz(null);
    clearForm();
  }

  function validateForm(): string | null {
    setTitleError('');
    setOrderError('');
    setTimeLimitError('');
    setPassingPercentageError('');
    setMaxAttemptsError('');

    if (!title.trim()) {
      setTitleError('Title is required');
      return 'Title is required';
    }

    const parsedOrder = parseInt(order, 10);
    if (order.trim() === '' || isNaN(parsedOrder) || parsedOrder < 0 || !Number.isInteger(parsedOrder)) {
      setOrderError('Order must be a non-negative integer');
      return 'Order must be a non-negative integer';
    }

    if (timeLimitMinutes.trim() !== '') {
      const parsed = parseInt(timeLimitMinutes, 10);
      if (isNaN(parsed) || parsed < 1 || !Number.isInteger(parsed)) {
        setTimeLimitError('Time limit must be a positive integer');
        return 'Time limit must be a positive integer';
      }
    }

    if (passingPercentage.trim() !== '') {
      const parsed = parseFloat(passingPercentage);
      if (isNaN(parsed) || parsed < 0 || parsed > 100) {
        setPassingPercentageError('Passing percentage must be between 0 and 100');
        return 'Passing percentage must be between 0 and 100';
      }
    }

    if (maxAttempts.trim() !== '') {
      const parsed = parseInt(maxAttempts, 10);
      if (isNaN(parsed) || parsed < 1 || !Number.isInteger(parsed)) {
        setMaxAttemptsError('Max attempts must be a positive integer');
        return 'Max attempts must be a positive integer';
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
      const apiBase = '';
      const body: Record<string, unknown> = {
        title: title.trim(),
        order: parseInt(order, 10),
      };
      if (description.trim()) body.description = description.trim();
      if (timeLimitMinutes.trim() !== '') body.timeLimitMinutes = parseInt(timeLimitMinutes, 10);
      if (passingPercentage.trim() !== '') body.passingPercentage = parseFloat(passingPercentage);
      if (maxAttempts.trim() !== '') body.maxAttempts = parseInt(maxAttempts, 10);

      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes`,
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
        if (code === 'QUIZ_ORDER_TAKEN') {
          setOrderError(getQuizErrorMessage(code));
        } else {
          toast.error(getQuizErrorMessage(code));
        }
        return;
      }

      toast.success('Quiz created successfully.');
      closeCreateModal();
      await reloadQuizzes();
    } catch {
      toast.error(getQuizErrorMessage(null));
    } finally {
      setCreating(false);
    }
  }

  async function openEditModal(quiz: QuizListItem) {
    if (!organizationId || !courseId || !moduleId) return;

    try {
      const apiBase = '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes/${quiz.id}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        let code: unknown = null;
        try {
          code = (await res.json())?.error;
        } catch {
          code = null;
        }
        toast.error(getQuizErrorMessage(code));
        return;
      }
      const body: QuizApiResponse = await res.json();
      const detail = body.data;
      if (!detail) return;

      setEditingQuiz(detail);
      setTitle(detail.title);
      setDescription(detail.description ?? '');
      setOrder(String(detail.order));
      setTimeLimitMinutes(detail.timeLimitMinutes != null ? String(detail.timeLimitMinutes) : '');
      setPassingPercentage(detail.passingPercentage != null ? String(detail.passingPercentage) : '');
      setMaxAttempts(detail.maxAttempts != null ? String(detail.maxAttempts) : '');
      setShowEditModal(true);
    } catch {
      toast.error(getQuizErrorMessage(null));
    }
  }

  async function handleUpdate() {
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!organizationId || !courseId || !moduleId || !editingQuiz) return;

    setUpdating(true);
    try {
      const apiBase = '';
      const body: Record<string, unknown> = {
        title: title.trim(),
        order: parseInt(order, 10),
      };
      if (description.trim()) body.description = description.trim();
      else body.description = null;
      if (timeLimitMinutes.trim() !== '') body.timeLimitMinutes = parseInt(timeLimitMinutes, 10);
      else body.timeLimitMinutes = null;
      if (passingPercentage.trim() !== '') body.passingPercentage = parseFloat(passingPercentage);
      else body.passingPercentage = null;
      if (maxAttempts.trim() !== '') body.maxAttempts = parseInt(maxAttempts, 10);
      else body.maxAttempts = null;

      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes/${editingQuiz.id}`,
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
        if (code === 'QUIZ_ORDER_TAKEN') {
          setOrderError(getQuizErrorMessage(code));
        } else {
          toast.error(getQuizErrorMessage(code));
        }
        return;
      }

      toast.success('Quiz updated successfully.');
      closeEditModal();
      await reloadQuizzes();
    } catch {
      toast.error(getQuizErrorMessage(null));
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete(quizId: string) {
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    if (!organizationId || !courseId || !moduleId) return;

    try {
      const apiBase = '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes/${quizId}`,
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
        toast.error(getQuizErrorMessage(code));
        return;
      }

      toast.success('Quiz deleted successfully.');
      await reloadQuizzes();
    } catch {
      toast.error(getQuizErrorMessage(null));
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
          <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Module Quizzes</p>
          <LinkButton href={`/dashboard/organization/courses/${courseId}/modules${organizationId ? `?organization=${organizationId}` : ''}`} variant="ghost" size="sm">
            Back to Modules
          </LinkButton>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Quizzes</h1>
              <p className="mt-1 text-sm text-neutral-500">
                Manage quizzes for this module.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              Create Quiz
            </Button>
          </div>

          {loading ? (
            <div className="mt-8 flex items-center gap-3 text-neutral-700">
              <Spinner size="md" label="Loading quizzes..." />
              <span>Loading quizzes...</span>
            </div>
          ) : quizzes !== null && quizzes.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                icon={EmptyStateIcons.NoData}
                title="No quizzes yet"
                description="Create your first quiz to start assessing learner knowledge."
                action={{
                  label: 'Create Quiz',
                  onClick: () => setShowCreateModal(true),
                  variant: 'primary',
                  size: 'sm',
                }}
              />
            </div>
          ) : quizzes !== null && quizzes.length > 0 ? (
            <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 w-16">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 w-24">Time Limit</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 w-24">Pass %</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 w-24">Attempts</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 w-40">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 bg-white">
                  {quizzes.map((quiz) => (
                    <tr key={quiz.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-4 text-sm font-medium text-neutral-900">
                        <Badge variant="default" size="sm">{quiz.order}</Badge>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-primary-600 hover:text-primary-700">
                        {quiz.title}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-700 max-w-md truncate">
                        {quiz.description ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-700">
                        {quiz.timeLimitMinutes != null ? `${quiz.timeLimitMinutes}m` : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-700">
                        {quiz.passingPercentage != null ? `${quiz.passingPercentage}%` : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-700">
                        {quiz.maxAttempts != null ? quiz.maxAttempts : '—'}
                      </td>
                      <td className="px-6 py-4 relative pl-2">
                        <QuizActionsMenu
                          quiz={quiz}
                          courseId={courseId!}
                          moduleId={moduleId!}
                          onEdit={() => openEditModal(quiz)}
                          onDelete={() => handleDelete(quiz.id)}
                        />
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
        title="Create Quiz"
        closeOnOverlayClick={!creating}
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            error={titleError}
            placeholder="e.g. Module 1 Quiz"
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
            helperText="Non-negative integer. Quizzes are displayed in ascending order."
          />

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Time Limit (min)"
              type="number"
              min="1"
              step="1"
              value={timeLimitMinutes}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTimeLimitMinutes(e.target.value)}
              error={timeLimitError}
              placeholder="e.g. 30"
              autoComplete="off"
              disabled={creating}
              helperText="Optional."
            />

            <Input
              label="Passing %"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={passingPercentage}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassingPercentage(e.target.value)}
              error={passingPercentageError}
              placeholder="e.g. 70"
              autoComplete="off"
              disabled={creating}
              helperText="0–100."
            />

            <Input
              label="Max Attempts"
              type="number"
              min="1"
              step="1"
              value={maxAttempts}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxAttempts(e.target.value)}
              error={maxAttemptsError}
              placeholder="e.g. 3"
              autoComplete="off"
              disabled={creating}
              helperText="Optional."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={closeCreateModal} disabled={creating}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreate} loading={creating} disabled={creating}>
              {creating ? 'Creating...' : 'Create Quiz'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={closeEditModal}
        title="Edit Quiz"
        closeOnOverlayClick={!updating}
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            error={titleError}
            placeholder="e.g. Module 1 Quiz"
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
            helperText="Non-negative integer. Quizzes are displayed in ascending order."
          />

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Time Limit (min)"
              type="number"
              min="1"
              step="1"
              value={timeLimitMinutes}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTimeLimitMinutes(e.target.value)}
              error={timeLimitError}
              placeholder="e.g. 30"
              autoComplete="off"
              disabled={updating}
              helperText="Optional."
            />

            <Input
              label="Passing %"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={passingPercentage}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassingPercentage(e.target.value)}
              error={passingPercentageError}
              placeholder="e.g. 70"
              autoComplete="off"
              disabled={updating}
              helperText="0–100."
            />

            <Input
              label="Max Attempts"
              type="number"
              min="1"
              step="1"
              value={maxAttempts}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxAttempts(e.target.value)}
              error={maxAttemptsError}
              placeholder="e.g. 3"
              autoComplete="off"
              disabled={updating}
              helperText="Optional."
            />
          </div>

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
