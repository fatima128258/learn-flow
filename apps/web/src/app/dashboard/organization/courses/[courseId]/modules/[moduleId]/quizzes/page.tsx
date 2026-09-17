'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Badge, Button, ConfirmModal, Drawer, EmptyState, EmptyStateIcons, Spinner } from '../../../../../../../../components/ui';
import { createPortal } from 'react-dom';
import { Input } from '../../../../../../../../components/ui/Input';
import { Textarea } from '../../../../../../../../components/forms/Textarea';
import { LinkButton } from '../../../../../../../../components/ui/LinkButton';
import { Modal } from '../../../../../../../../components/ui/Modal';
import Link from 'next/link';
import { getQuizErrorMessage } from '../../../../../../../../features/course/quizErrors';
import { useToast } from '../../../../../../../../components/ui/ToastProvider';

import { useCurrentUser } from '../../../../../../../../features/auth/useCurrentUser';
import { ViewToggle, DataViewMode } from '../../../../../../../../components/ui/ViewToggle';

// 3-dot menu component for quizzes
function QuizActionsMenu({ quiz, courseId, moduleId, dashboardPrefix, onEdit, onDelete }: {
  quiz: { id: string; title: string };
  courseId: string;
  moduleId: string;
  dashboardPrefix: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });

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
      const menuHeight = 144;
      const right = Math.max(8, window.innerWidth - rect.right);
      const belowTop = rect.bottom + 8;
      const top = belowTop + menuHeight <= window.innerHeight - 8
        ? belowTop
        : Math.max(8, rect.top - menuHeight - 8);
      setMenuPosition({ top, right });
    }
    setIsOpen(!isOpen);
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className="inline-flex items-center justify-center rounded-lg border-0 p-1 text-neutral-900 transition-colors hover:bg-neutral-100 focus:border-0 focus:outline-none focus-visible:border-0 focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
        aria-label="Quiz actions"
      >
        <svg className="h-5 w-5 text-neutral-900" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 8c1.1 0 2-0.9 2-2s-0.9-2-2-2-2 0.9-2 2 0.9 2 2 2zm0 2c-1.1 0-2 0.9-2 2s0.9 2 2 2 2-0.9 2-2-0.9-2-2-2zm0 6c-1.1 0-2 0.9-2 2s0.9 2 2 2 2-0.9 2-2-0.9-2-2-2z" />
        </svg>
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPosition.top, right: menuPosition.right, zIndex: 9999 }}
          className="w-48 rounded-lg border border-neutral-200 bg-white text-left shadow-lg"
        >
          <Link
            href={`${dashboardPrefix}/courses/${courseId}/modules/${moduleId}/quizzes/${quiz.id}/questions`}
            className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 border-b border-neutral-100 first:rounded-t-lg focus:outline-none focus-visible:outline-none"
            onClick={() => setIsOpen(false)}
          >
            Questions
          </Link>
          <button
            onClick={() => {
              onEdit();
              setIsOpen(false);
            }}
            className="w-full border-0 text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 border-b border-neutral-100 focus:border-0 focus:outline-none focus-visible:border-0 focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
          >
            Edit
          </button>
          <button
            onClick={() => {
              onDelete();
              setIsOpen(false);
            }}
            className="w-full border-0 text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-b-lg focus:border-0 focus:outline-none focus-visible:border-0 focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
          >
            Delete
          </button>
        </div>,
        document.body,
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

type QuizOption = {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
};

type QuizQuestion = {
  id: string;
  questionText: string;
  marks: number;
  order: number;
  options: QuizOption[];
};

type QuizDrawerData = {
  quiz: QuizListItem;
  questions: QuizQuestion[];
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
  const pathname = usePathname();
  const dashboardPrefix = pathname.startsWith('/dashboard/instructor') ? '/dashboard/instructor' : '/dashboard/organization';
  const toast = useToast();
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<QuizListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<DataViewMode>('table');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<QuizDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<QuizDrawerData | null>(null);
  const [loadingQuizDetails, setLoadingQuizDetails] = useState(false);

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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

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

    const timer = window.setTimeout(() => {
      setOrganizationId(orgId);
      setCheckingAuth(false);
    }, 0);
    return () => window.clearTimeout(timer);
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

  async function openQuizDetails(quiz: QuizListItem) {
    if (!organizationId || !courseId || !moduleId) return;
    setLoadingQuizDetails(true);
    setSelectedQuiz({ quiz, questions: [] });
    try {
      const prefix = `/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes/${quiz.id}`;
      const [quizResponse, questionsResponse] = await Promise.all([
        fetch(prefix, { credentials: 'include' }),
        fetch(`${prefix}/questions`, { credentials: 'include' }),
      ]);
      if (!quizResponse.ok || !questionsResponse.ok) throw new Error('Unable to load quiz details');
      const quizBody: QuizApiResponse = await quizResponse.json();
      const questionsBody: { success?: boolean; data?: Array<{ id: string; questionText: string; marks: number; order: number }> } = await questionsResponse.json();
      const questions = await Promise.all((questionsBody.data ?? []).map(async (question) => {
        const response = await fetch(`${prefix}/questions/${question.id}`, { credentials: 'include' });
        if (!response.ok) throw new Error('Unable to load question details');
        const body: { success?: boolean; data?: QuizQuestion } = await response.json();
        return body.data ?? { ...question, options: [] };
      }));
      if (!quizBody.data) throw new Error('Quiz details are unavailable');
      setSelectedQuiz({ quiz: quizBody.data, questions: questions.sort((a, b) => a.order - b.order) });
    } catch {
      setSelectedQuiz(null);
      toast.error('Unable to load quiz details');
    } finally {
      setLoadingQuizDetails(false);
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

    if (timeLimitMinutes.trim() === '') {
      setTimeLimitError('Time limit is required');
      return 'Time limit is required';
    }
    {
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

    if (maxAttempts.trim() === '') {
      setMaxAttemptsError('Max attempts is required');
      return 'Max attempts is required';
    }
    {
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
      body.timeLimitMinutes = parseInt(timeLimitMinutes, 10);
      if (passingPercentage.trim() !== '') body.passingPercentage = parseFloat(passingPercentage);
      body.maxAttempts = parseInt(maxAttempts, 10);

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

      const createdBody: { data?: { id?: string } } = await res.json();
      if (createdBody.data?.id) {
        toast.success('Quiz created. Add questions and options to continue.');
        router.push(`${dashboardPrefix}/courses/${courseId}/modules/${moduleId}/quizzes/${createdBody.data.id}/questions${organizationId ? `?organization=${organizationId}` : ''}`);
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
    if (!organizationId || !courseId || !moduleId) return;

    setDeleting(true);
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
      setDeleteTarget(null);
      await reloadQuizzes();
    } catch {
      toast.error(getQuizErrorMessage(null));
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
          <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Module Quizzes</p>
          <LinkButton href={`${dashboardPrefix}/courses/${courseId}/modules${organizationId ? `?organization=${organizationId}` : ''}`} variant="ghost" size="sm">
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
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                className="h-10"
                onClick={() => router.push(`${dashboardPrefix}/courses/${courseId}/modules/${moduleId}/quizzes/new${organizationId ? `?organization=${organizationId}` : ''}`)}
              >
                Create Quiz
              </Button>
              <ViewToggle value={viewMode} onChange={setViewMode} storageKey="module-quizzes-view" />
            </div>
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
                  onClick: () => router.push(`${dashboardPrefix}/courses/${courseId}/modules/${moduleId}/quizzes/new${organizationId ? `?organization=${organizationId}` : ''}`),
                  variant: 'primary',
                  size: 'sm',
                }}
              />
            </div>
          ) : quizzes !== null && quizzes.length > 0 && viewMode === 'table' ? (
            <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-6 py-3 text-center align-middle text-xs font-semibold uppercase tracking-wide text-neutral-500 w-16">Order</th>
                    <th className="w-72 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Title</th>
                    <th className="w-32 whitespace-nowrap px-6 py-3 text-center align-middle text-xs font-semibold uppercase tracking-wide text-neutral-500">Time Limit</th>
                    <th className="px-6 py-3 text-center align-middle text-xs font-semibold uppercase tracking-wide text-neutral-500 w-24">Pass %</th>
                    <th className="px-6 py-3 text-center align-middle text-xs font-semibold uppercase tracking-wide text-neutral-500 w-24">Attempts</th>
                    <th className="px-6 py-3 text-center align-middle text-xs font-semibold uppercase tracking-wide text-neutral-500 w-40">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 bg-white">
                  {quizzes.map((quiz) => (
                    <tr key={quiz.id} className="cursor-pointer hover:bg-neutral-50" onClick={() => void openQuizDetails(quiz)}>
                      <td className="px-6 py-4 text-center align-middle text-sm font-medium text-neutral-900">
                        <Badge variant="default" size="sm">{quiz.order}</Badge>
                      </td>
                      <td className="w-72 max-w-72 px-6 py-4 text-sm font-medium text-primary-600 hover:text-primary-700" title={quiz.title}>
                        <span className="block truncate">{quiz.title}</span>
                      </td>
                      <td className="w-32 whitespace-nowrap px-6 py-4 text-center align-middle text-sm text-neutral-700">
                        {quiz.timeLimitMinutes != null ? `${quiz.timeLimitMinutes} min` : 'No limit'}
                      </td>
                      <td className="px-6 py-4 text-center align-middle text-sm text-neutral-700">
                        {quiz.passingPercentage != null ? `${quiz.passingPercentage}%` : '—'}
                      </td>
                      <td className="px-6 py-4 text-center align-middle text-sm text-neutral-700">
                        {quiz.maxAttempts != null ? quiz.maxAttempts : '—'}
                      </td>
                      <td className="px-6 py-4 text-center align-middle" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-center">
                          <QuizActionsMenu
                            quiz={quiz}
                            courseId={courseId!}
                            moduleId={moduleId!}
                            dashboardPrefix={dashboardPrefix}
                            onEdit={() => openEditModal(quiz)}
                            onDelete={() => setDeleteTarget({ id: quiz.id, title: quiz.title })}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          ) : quizzes !== null && quizzes.length > 0 && viewMode === 'cards' ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="cursor-pointer rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                  onClick={() => void openQuizDetails(quiz)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Quiz {quiz.order}</p>
                      <h2 className="mt-1 truncate text-lg font-semibold text-primary-600" title={quiz.title}>{quiz.title}</h2>
                    </div>
                    <div onClick={(event) => event.stopPropagation()}>
                      <QuizActionsMenu
                        quiz={quiz}
                        courseId={courseId!}
                        moduleId={moduleId!}
                        dashboardPrefix={dashboardPrefix}
                        onEdit={() => openEditModal(quiz)}
                        onDelete={() => setDeleteTarget({ id: quiz.id, title: quiz.title })}
                      />
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-neutral-400">Time limit</p>
                      <p className="mt-1 font-medium text-neutral-700">{quiz.timeLimitMinutes != null ? `${quiz.timeLimitMinutes} min` : 'No limit'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-neutral-400">Pass score</p>
                      <p className="mt-1 font-medium text-neutral-700">{quiz.passingPercentage != null ? `${quiz.passingPercentage}%` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-neutral-400">Attempts</p>
                      <p className="mt-1 font-medium text-neutral-700">{quiz.maxAttempts ?? 'Unlimited'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <Drawer
        isOpen={Boolean(selectedQuiz)}
        onClose={() => {
          if (!loadingQuizDetails) setSelectedQuiz(null);
        }}
        title={selectedQuiz?.quiz.title ?? 'Quiz details'}
      >
        {loadingQuizDetails ? (
          <div className="flex items-center gap-3 text-neutral-700">
            <Spinner size="md" label="Loading quiz details..." />
            <span>Loading quiz details...</span>
          </div>
        ) : selectedQuiz ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Order</p><p className="mt-1 text-neutral-800">{selectedQuiz.quiz.order}</p></div>
              <div><p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Questions</p><p className="mt-1 text-neutral-800">{selectedQuiz.questions.length}</p></div>
              <div><p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Time limit</p><p className="mt-1 text-neutral-800">{selectedQuiz.quiz.timeLimitMinutes != null ? `${selectedQuiz.quiz.timeLimitMinutes} minutes` : 'No limit'}</p></div>
              <div><p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Passing score</p><p className="mt-1 text-neutral-800">{selectedQuiz.quiz.passingPercentage != null ? `${selectedQuiz.quiz.passingPercentage}%` : '—'}</p></div>
              <div><p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Max attempts</p><p className="mt-1 text-neutral-800">{selectedQuiz.quiz.maxAttempts ?? 'Unlimited'}</p></div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Description</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{selectedQuiz.quiz.description || 'No description available.'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Questions</p>
              {selectedQuiz.questions.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-400">No questions available.</p>
              ) : (
                <div className="mt-3 space-y-4">
                  {selectedQuiz.questions.map((question) => (
                    <div key={question.id} className="rounded-lg border border-neutral-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-neutral-900">{question.order + 1}. {question.questionText}</p>
                        <Badge variant="default" size="sm">{question.marks} {question.marks === 1 ? 'mark' : 'marks'}</Badge>
                      </div>
                      <div className="mt-3 space-y-2">
                        {question.options.length === 0 ? (
                          <p className="text-sm text-neutral-400">No options available.</p>
                        ) : question.options.sort((a, b) => a.order - b.order).map((option) => (
                          <div key={option.id} className={`rounded-md px-3 py-2 text-sm ${option.isCorrect ? 'bg-green-50 font-medium text-green-800' : 'bg-neutral-50 text-neutral-700'}`}>
                            {option.isCorrect ? '✓ ' : ''}{option.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Drawer>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => { if (!deleting) setDeleteTarget(null); }}
        onConfirm={() => { if (deleteTarget) void handleDelete(deleteTarget.id); }}
        title="Delete quiz?"
        message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.title}"? This action cannot be undone.` : ''}
        confirmLabel="Delete quiz"
        variant="danger"
        loading={deleting}
      />

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
              required
              helperText="Required. Minimum 1 minute."
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
              required
              helperText="Required. Minimum 1 attempt."
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
              required
              helperText="Required. Minimum 1 minute."
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
              required
              helperText="Required. Minimum 1 attempt."
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
