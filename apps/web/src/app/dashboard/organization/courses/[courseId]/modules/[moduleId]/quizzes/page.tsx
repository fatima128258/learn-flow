'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge, Button, EmptyState, EmptyStateIcons, Spinner } from '../../../../../../../../components/ui';
import { FormError } from '../../../../../../../../components/forms/FormError';
import { Input } from '../../../../../../../../components/ui/Input';
import { Textarea } from '../../../../../../../../components/forms/Textarea';
import { LinkButton } from '../../../../../../../../components/ui/LinkButton';
import { Modal } from '../../../../../../../../components/ui/Modal';
import Link from 'next/link';
import { getQuizErrorMessage } from '../../../../../../../../features/course/quizErrors';

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

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<QuizListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      setError(null);
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
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
          setError(getQuizErrorMessage(code));
          return;
        }
        const body: ListQuizzesResponse = await res.json();
        if (!active) return;
        setQuizzes(body.data ?? []);
      } catch {
        if (active) setError(getQuizErrorMessage(null));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [organizationId, courseId, moduleId]);

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

  function validateForm(): boolean {
    setTitleError('');
    setOrderError('');
    setTimeLimitError('');
    setPassingPercentageError('');
    setMaxAttemptsError('');
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

    if (timeLimitMinutes.trim() !== '') {
      const parsed = parseInt(timeLimitMinutes, 10);
      if (isNaN(parsed) || parsed < 1 || !Number.isInteger(parsed)) {
        setTimeLimitError('Time limit must be a positive integer');
        isValid = false;
      }
    }

    if (passingPercentage.trim() !== '') {
      const parsed = parseFloat(passingPercentage);
      if (isNaN(parsed) || parsed < 0 || parsed > 100) {
        setPassingPercentageError('Passing percentage must be between 0 and 100');
        isValid = false;
      }
    }

    if (maxAttempts.trim() !== '') {
      const parsed = parseInt(maxAttempts, 10);
      if (isNaN(parsed) || parsed < 1 || !Number.isInteger(parsed)) {
        setMaxAttemptsError('Max attempts must be a positive integer');
        isValid = false;
      }
    }

    return isValid;
  }

  async function handleCreate() {
    if (!validateForm()) return;
    if (!organizationId || !courseId || !moduleId) return;

    setCreating(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
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
          setError(getQuizErrorMessage(code));
        }
        return;
      }

      closeCreateModal();
      setSuccessMessage('Quiz created successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
      router.refresh();
    } catch {
      setError(getQuizErrorMessage(null));
    } finally {
      setCreating(false);
    }
  }

  async function openEditModal(quiz: QuizListItem) {
    if (!organizationId || !courseId || !moduleId) return;

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
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
        setError(getQuizErrorMessage(code));
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
      setError(getQuizErrorMessage(null));
    }
  }

  async function handleUpdate() {
    if (!validateForm()) return;
    if (!organizationId || !courseId || !moduleId || !editingQuiz) return;

    setUpdating(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
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
          setError(getQuizErrorMessage(code));
        }
        return;
      }

      closeEditModal();
      setSuccessMessage('Quiz updated successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
      router.refresh();
    } catch {
      setError(getQuizErrorMessage(null));
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete(quizId: string) {
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    if (!organizationId || !courseId || !moduleId) return;

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
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
        setError(getQuizErrorMessage(code));
        return;
      }

      setSuccessMessage('Quiz deleted successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
      router.refresh();
    } catch {
      setError(getQuizErrorMessage(null));
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
          <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Module Quizzes</p>
          <LinkButton href={`/dashboard/organization/courses/${courseId}/modules`} variant="ghost" size="sm">
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

          {successMessage ? (
            <div className="mt-4 rounded-md bg-success-50 p-3 text-sm text-success-700">
              {successMessage}
            </div>
          ) : null}

          {error ? (
            <div className="mt-6">
              <FormError message={error} />
            </div>
          ) : null}

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
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/organization/courses/${courseId}/modules/${moduleId}/quizzes/${quiz.id}/questions`}
                            className="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 transition-colors"
                          >
                            Questions
                          </Link>
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(quiz)}>
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleDelete(quiz.id)}>
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
    </main>
  );
}
