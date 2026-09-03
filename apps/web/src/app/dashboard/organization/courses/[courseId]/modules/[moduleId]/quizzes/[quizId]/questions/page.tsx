'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge, Button, EmptyState, EmptyStateIcons, Spinner } from '../../../../../../../../../../components/ui';
import { Input } from '../../../../../../../../../../components/ui/Input';
import { Textarea } from '../../../../../../../../../../components/forms/Textarea';
import { LinkButton } from '../../../../../../../../../../components/ui/LinkButton';
import { Modal } from '../../../../../../../../../../components/ui/Modal';
import Link from 'next/link';
import { getQuizErrorMessage } from '../../../../../../../../../../features/course/quizErrors';
import { useToast } from '../../../../../../../../../../components/ui/ToastProvider';

import { useCurrentUser } from '../../../../../../../../../../features/auth/useCurrentUser';

type QuestionListItem = {
  id: string;
  quizId: string;
  questionText: string;
  marks: number;
  order: number;
  createdAt: string;
  updatedAt: string;
};

type OptionItem = {
  id: string;
  questionId: string;
  text: string;
  isCorrect: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
};

type QuestionDetail = QuestionListItem & {
  options: OptionItem[];
};

type ListQuestionsResponse = {
  success?: boolean;
  data?: QuestionListItem[];
  error?: string;
};

type QuestionApiResponse = {
  success?: boolean;
  data?: QuestionDetail;
  error?: string;
};

type ListOptionsResponse = {
  success?: boolean;
  data?: OptionItem[];
  error?: string;
};

type DeleteResponse = {
  success?: boolean;
  error?: string;
};

export default function QuizQuestionsPage() {
  const params = useParams();
  const courseId = typeof params.courseId === 'string' ? params.courseId : null;
  const moduleId = typeof params.moduleId === 'string' ? params.moduleId : null;
  const quizId = typeof params.quizId === 'string' ? params.quizId : null;
  const router = useRouter();
  const toast = useToast();
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionListItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [questionText, setQuestionText] = useState('');
  const [marks, setMarks] = useState('');
  const [order, setOrder] = useState('');
  const [questionTextError, setQuestionTextError] = useState('');
  const [marksError, setMarksError] = useState('');
  const [orderError, setOrderError] = useState('');

  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [questionOptions, setQuestionOptions] = useState<Record<string, OptionItem[]>>({});
  const [loadingOptions, setLoadingOptions] = useState<string | null>(null);

  const [showCreateOptionModal, setShowCreateOptionModal] = useState(false);
  const [showEditOptionModal, setShowEditOptionModal] = useState(false);
  const [editingOption, setEditingOption] = useState<OptionItem | null>(null);
  const [creatingOption, setCreatingOption] = useState(false);
  const [updatingOption, setUpdatingOption] = useState(false);
  const [optionTargetQuestion, setOptionTargetQuestion] = useState<string | null>(null);

  const [optionText, setOptionText] = useState('');
  const [optionIsCorrect, setOptionIsCorrect] = useState(false);
  const [optionOrder, setOptionOrder] = useState('');
  const [optionTextError, setOptionTextError] = useState('');
  const [optionOrderError, setOptionOrderError] = useState('');

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
    if (!organizationId || !courseId || !moduleId || !quizId) return;
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const apiBase = '';
        const res = await fetch(
          `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes/${quizId}/questions`,
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
        const body: ListQuestionsResponse = await res.json();
        if (!active) return;
        setQuestions(body.data ?? []);
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
  }, [organizationId, courseId, moduleId, quizId, toast]);

  async function reloadQuestions() {
    if (!organizationId || !courseId || !moduleId || !quizId) return;
    setLoading(true);
    try {
      const apiBase = '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes/${quizId}/questions`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const body: ListQuestionsResponse = await res.json();
        setQuestions(body.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function reloadOptions(questionId: string) {
    if (!organizationId || !courseId || !moduleId || !quizId) return;
    try {
      const apiBase = '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes/${quizId}/questions/${questionId}/options`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const body: ListOptionsResponse = await res.json();
        setQuestionOptions((prev) => ({ ...prev, [questionId]: body.data ?? [] }));
      }
    } catch {
      // silent fail
    }
  }

  function clearForm() {
    setQuestionText('');
    setMarks('');
    setOrder('');
    setQuestionTextError('');
    setMarksError('');
    setOrderError('');
  }

  function clearOptionForm() {
    setOptionText('');
    setOptionIsCorrect(false);
    setOptionOrder('');
    setOptionTextError('');
    setOptionOrderError('');
  }

  function closeCreateModal() {
    if (creating) return;
    setShowCreateModal(false);
    clearForm();
  }

  function closeEditModal() {
    if (updating) return;
    setShowEditModal(false);
    setEditingQuestion(null);
    clearForm();
  }

  function closeCreateOptionModal() {
    if (creatingOption) return;
    setShowCreateOptionModal(false);
    setOptionTargetQuestion(null);
    clearOptionForm();
  }

  function closeEditOptionModal() {
    if (updatingOption) return;
    setShowEditOptionModal(false);
    setEditingOption(null);
    setOptionTargetQuestion(null);
    clearOptionForm();
  }

  function validateQuestionForm(): string | null {
    setQuestionTextError('');
    setMarksError('');
    setOrderError('');

    if (!questionText.trim()) {
      setQuestionTextError('Question text is required');
      return 'Question text is required';
    }

    const parsedOrder = parseInt(order, 10);
    if (order.trim() === '' || isNaN(parsedOrder) || parsedOrder < 0 || !Number.isInteger(parsedOrder)) {
      setOrderError('Order must be a non-negative integer');
      return 'Order must be a non-negative integer';
    }

    if (marks.trim() !== '') {
      const parsedMarks = parseInt(marks, 10);
      if (isNaN(parsedMarks) || parsedMarks < 1 || !Number.isInteger(parsedMarks)) {
        setMarksError('Marks must be a positive integer');
        return 'Marks must be a positive integer';
      }
    }

    return null;
  }

  function validateOptionForm(): string | null {
    setOptionTextError('');
    setOptionOrderError('');

    if (!optionText.trim()) {
      setOptionTextError('Option text is required');
      return 'Option text is required';
    }

    const parsedOrder = parseInt(optionOrder, 10);
    if (optionOrder.trim() === '' || isNaN(parsedOrder) || parsedOrder < 0 || !Number.isInteger(parsedOrder)) {
      setOptionOrderError('Order must be a non-negative integer');
      return 'Order must be a non-negative integer';
    }

    return null;
  }

  async function handleCreate() {
    const validationError = validateQuestionForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!organizationId || !courseId || !moduleId || !quizId) return;

    setCreating(true);
    try {
      const apiBase = '';
      const body: Record<string, unknown> = {
        questionText: questionText.trim(),
        order: parseInt(order, 10),
      };
      if (marks.trim() !== '') body.marks = parseInt(marks, 10);

      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes/${quizId}/questions`,
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
        if (code === 'QUESTION_ORDER_TAKEN') {
          setOrderError(getQuizErrorMessage(code));
        } else {
          toast.error(getQuizErrorMessage(code));
        }
        return;
      }

      closeCreateModal();
      toast.success('Question created successfully.');
      await reloadQuestions();
    } catch {
      toast.error(getQuizErrorMessage(null));
    } finally {
      setCreating(false);
    }
  }

  async function openEditModal(question: QuestionListItem) {
    if (!organizationId || !courseId || !moduleId || !quizId) return;

    try {
      const apiBase = '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes/${quizId}/questions/${question.id}`,
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
      const body: QuestionApiResponse = await res.json();
      const detail = body.data;
      if (!detail) return;

      setEditingQuestion(detail);
      setQuestionText(detail.questionText);
      setMarks(detail.marks != null ? String(detail.marks) : '1');
      setOrder(String(detail.order));
      setShowEditModal(true);
    } catch {
      toast.error(getQuizErrorMessage(null));
    }
  }

  async function handleUpdate() {
    const validationError = validateQuestionForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!organizationId || !courseId || !moduleId || !quizId || !editingQuestion) return;

    setUpdating(true);
    try {
      const apiBase = '';
      const body: Record<string, unknown> = {
        questionText: questionText.trim(),
        order: parseInt(order, 10),
      };
      if (marks.trim() !== '') body.marks = parseInt(marks, 10);

      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes/${quizId}/questions/${editingQuestion.id}`,
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
        if (code === 'QUESTION_ORDER_TAKEN') {
          setOrderError(getQuizErrorMessage(code));
        } else {
          toast.error(getQuizErrorMessage(code));
        }
        return;
      }

      closeEditModal();
      toast.success('Question updated successfully.');
      await reloadQuestions();
    } catch {
      toast.error(getQuizErrorMessage(null));
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    if (!confirm('Are you sure you want to delete this question and all its options?')) return;
    if (!organizationId || !courseId || !moduleId || !quizId) return;

    try {
      const apiBase = '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes/${quizId}/questions/${questionId}`,
        { method: 'DELETE', credentials: 'include' }
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

      toast.success('Question deleted successfully.');
      if (expandedQuestion === questionId) setExpandedQuestion(null);
      await reloadQuestions();
    } catch {
      toast.error(getQuizErrorMessage(null));
    }
  }

  async function toggleOptions(questionId: string) {
    if (expandedQuestion === questionId) {
      setExpandedQuestion(null);
      return;
    }

    setExpandedQuestion(questionId);

    if (questionOptions[questionId]) return;

    if (!organizationId || !courseId || !moduleId || !quizId) return;

    setLoadingOptions(questionId);
    try {
      const apiBase = '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes/${quizId}/questions/${questionId}/options`,
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
      const body: ListOptionsResponse = await res.json();
      setQuestionOptions((prev) => ({ ...prev, [questionId]: body.data ?? [] }));
    } catch {
      toast.error(getQuizErrorMessage(null));
    } finally {
      setLoadingOptions(null);
    }
  }

  function openCreateOptionModal(questionId: string) {
    setOptionTargetQuestion(questionId);
    clearOptionForm();
    setShowCreateOptionModal(true);
  }

  async function handleCreateOption() {
    const validationError = validateOptionForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!organizationId || !courseId || !moduleId || !quizId || !optionTargetQuestion) return;

    setCreatingOption(true);
    try {
      const apiBase = '';
      const body: Record<string, unknown> = {
        text: optionText.trim(),
        order: parseInt(optionOrder, 10),
        isCorrect: optionIsCorrect,
      };

      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes/${quizId}/questions/${optionTargetQuestion}/options`,
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
        if (code === 'OPTION_ORDER_TAKEN') {
          setOptionOrderError(getQuizErrorMessage(code));
        } else {
          toast.error(getQuizErrorMessage(code));
        }
        return;
      }

      closeCreateOptionModal();
      toast.success('Option created successfully.');
      await reloadOptions(optionTargetQuestion);
    } catch {
      toast.error(getQuizErrorMessage(null));
    } finally {
      setCreatingOption(false);
    }
  }

  async function openEditOptionModal(questionId: string, option: OptionItem) {
    setOptionTargetQuestion(questionId);
    setEditingOption(option);
    setOptionText(option.text);
    setOptionIsCorrect(option.isCorrect);
    setOptionOrder(String(option.order));
    setShowEditOptionModal(true);
  }

  async function handleUpdateOption() {
    const validationError = validateOptionForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!organizationId || !courseId || !moduleId || !quizId || !optionTargetQuestion || !editingOption) return;

    setUpdatingOption(true);
    try {
      const apiBase = '';
      const body: Record<string, unknown> = {
        text: optionText.trim(),
        order: parseInt(optionOrder, 10),
        isCorrect: optionIsCorrect,
      };

      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes/${quizId}/questions/${optionTargetQuestion}/options/${editingOption.id}`,
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
        if (code === 'OPTION_ORDER_TAKEN') {
          setOptionOrderError(getQuizErrorMessage(code));
        } else {
          toast.error(getQuizErrorMessage(code));
        }
        return;
      }

      closeEditOptionModal();
      toast.success('Option updated successfully.');
      await reloadOptions(optionTargetQuestion);
    } catch {
      toast.error(getQuizErrorMessage(null));
    } finally {
      setUpdatingOption(false);
    }
  }

  async function handleDeleteOption(questionId: string, optionId: string) {
    if (!confirm('Are you sure you want to delete this option?')) return;
    if (!organizationId || !courseId || !moduleId || !quizId) return;

    try {
      const apiBase = '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes/${quizId}/questions/${questionId}/options/${optionId}`,
        { method: 'DELETE', credentials: 'include' }
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

      toast.success('Option deleted successfully.');
      await reloadOptions(questionId);
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
          <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Quiz Questions</p>
          <LinkButton
            href={`/dashboard/organization/courses/${courseId}/modules/${moduleId}/quizzes${organizationId ? `?organization=${organizationId}` : ''}`}
            variant="ghost"
            size="sm"
          >
            Back to Quizzes
          </LinkButton>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Questions</h1>
              <p className="mt-1 text-sm text-neutral-500">
                Manage questions and answer options for this quiz.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              Create Question
            </Button>
          </div>

          {loading ? (
            <div className="mt-8 flex items-center gap-3 text-neutral-700">
              <Spinner size="md" label="Loading questions..." />
              <span>Loading questions...</span>
            </div>
          ) : questions !== null && questions.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                icon={EmptyStateIcons.NoData}
                title="No questions yet"
                description="Create your first question to start building this quiz."
                action={{
                  label: 'Create Question',
                  onClick: () => setShowCreateModal(true),
                  variant: 'primary',
                  size: 'sm',
                }}
              />
            </div>
          ) : questions !== null && questions.length > 0 ? (
            <div className="mt-6 space-y-3">
              {questions.map((question) => (
                <div
                  key={question.id}
                  className="rounded-xl border border-neutral-200 bg-white"
                >
                  <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-start gap-3">
                      <Badge variant="default" size="sm">{question.order}</Badge>
                      <div>
                        <p className="text-sm font-medium text-neutral-900">{question.questionText}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleOptions(question.id)}
                      >
                        {expandedQuestion === question.id ? 'Hide Options' : 'Options'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(question)}>
                        Edit
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDeleteQuestion(question.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>

                  {expandedQuestion === question.id && (
                    <div className="border-t border-neutral-200 bg-neutral-50 px-5 py-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Answer Options
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openCreateOptionModal(question.id)}
                        >
                          Add Option
                        </Button>
                      </div>

                      {loadingOptions === question.id ? (
                        <div className="flex items-center gap-2 text-neutral-500">
                          <Spinner size="sm" label="Loading options..." />
                          <span className="text-sm">Loading options...</span>
                        </div>
                      ) : questionOptions[question.id] && questionOptions[question.id].length > 0 ? (
                        <div className="space-y-2">
                          {questionOptions[question.id].map((option) => (
                            <div
                              key={option.id}
                              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3"
                            >
                              <div className="flex items-center gap-3">
                                <Badge variant={option.isCorrect ? 'success' : 'default'} size="sm">
                                  {option.order}
                                </Badge>
                                <span className="text-sm text-neutral-900">{option.text}</span>
                                {option.isCorrect ? (
                                  <Badge variant="success" size="sm">Correct</Badge>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditOptionModal(question.id, option)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => handleDeleteOption(question.id, option.id)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : questionOptions[question.id] && questionOptions[question.id].length === 0 ? (
                        <p className="text-sm text-neutral-500">
                          No options yet. Add at least two options for this question.
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        title="Create Question"
        closeOnOverlayClick={!creating}
      >
        <div className="space-y-4">
          <Textarea
            label="Question Text"
            value={questionText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setQuestionText(e.target.value)}
            error={questionTextError}
            placeholder="e.g. What is the capital of France?"
            autoComplete="off"
            disabled={creating}
            rows={3}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Marks"
              type="number"
              min="1"
              step="1"
              value={marks}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMarks(e.target.value)}
              error={marksError}
              placeholder="1"
              autoComplete="off"
              disabled={creating}
              helperText="Default: 1."
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
              {creating ? 'Creating...' : 'Create Question'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={closeEditModal}
        title="Edit Question"
        closeOnOverlayClick={!updating}
      >
        <div className="space-y-4">
          <Textarea
            label="Question Text"
            value={questionText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setQuestionText(e.target.value)}
            error={questionTextError}
            placeholder="e.g. What is the capital of France?"
            autoComplete="off"
            disabled={updating}
            rows={3}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Marks"
              type="number"
              min="1"
              step="1"
              value={marks}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMarks(e.target.value)}
              error={marksError}
              placeholder="1"
              autoComplete="off"
              disabled={updating}
              helperText="Default: 1."
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

      <Modal
        isOpen={showCreateOptionModal}
        onClose={closeCreateOptionModal}
        title="Create Option"
        closeOnOverlayClick={!creatingOption}
      >
        <div className="space-y-4">
          <Input
            label="Option Text"
            value={optionText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptionText(e.target.value)}
            error={optionTextError}
            placeholder="e.g. Paris"
            autoComplete="off"
            disabled={creatingOption}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Order"
              type="number"
              min="0"
              step="1"
              value={optionOrder}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptionOrder(e.target.value)}
              error={optionOrderError}
              placeholder="e.g. 0"
              autoComplete="off"
              disabled={creatingOption}
              required
              helperText="Non-negative integer."
            />

            <label className="flex items-center gap-2 text-sm text-neutral-700 pt-6">
              <input
                type="checkbox"
                checked={optionIsCorrect}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptionIsCorrect(e.target.checked)}
                disabled={creatingOption}
                className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              Correct answer
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={closeCreateOptionModal} disabled={creatingOption}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateOption} loading={creatingOption} disabled={creatingOption}>
              {creatingOption ? 'Creating...' : 'Create Option'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showEditOptionModal}
        onClose={closeEditOptionModal}
        title="Edit Option"
        closeOnOverlayClick={!updatingOption}
      >
        <div className="space-y-4">
          <Input
            label="Option Text"
            value={optionText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptionText(e.target.value)}
            error={optionTextError}
            placeholder="e.g. Paris"
            autoComplete="off"
            disabled={updatingOption}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Order"
              type="number"
              min="0"
              step="1"
              value={optionOrder}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptionOrder(e.target.value)}
              error={optionOrderError}
              placeholder="e.g. 0"
              autoComplete="off"
              disabled={updatingOption}
              required
              helperText="Non-negative integer."
            />

            <label className="flex items-center gap-2 text-sm text-neutral-700 pt-6">
              <input
                type="checkbox"
                checked={optionIsCorrect}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptionIsCorrect(e.target.checked)}
                disabled={updatingOption}
                className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              Correct answer
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={closeEditOptionModal} disabled={updatingOption}>
              Cancel
            </Button>
            <Button type="button" onClick={handleUpdateOption} loading={updatingOption} disabled={updatingOption}>
              {updatingOption ? 'Updating...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
