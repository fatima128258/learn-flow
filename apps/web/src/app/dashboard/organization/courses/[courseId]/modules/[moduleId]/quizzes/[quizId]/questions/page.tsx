'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
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
  options?: OptionItem[];
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
  const pathname = usePathname();
  const dashboardPrefix = pathname.startsWith('/dashboard/instructor') ? '/dashboard/instructor' : '/dashboard/organization';
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
  const [inlineQuestionText, setInlineQuestionText] = useState('');
  const [inlineMarks, setInlineMarks] = useState('1');
  const [inlineOptions, setInlineOptions] = useState([{ text: '', isCorrect: true }]);
  const [inlineEditingQuestionId, setInlineEditingQuestionId] = useState<string | null>(null);
  const [savingInlineQuestion, setSavingInlineQuestion] = useState(false);

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

  useEffect(() => {
    if (!expandedQuestion) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [expandedQuestion]);

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
        setQuestionOptions(
          Object.fromEntries(
            (body.data ?? [])
              .filter((question) => question.options)
              .map((question) => [question.id, question.options ?? []]),
          ),
        );
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
        setQuestionOptions(
          Object.fromEntries(
            (body.data ?? [])
              .filter((question) => question.options)
              .map((question) => [question.id, question.options ?? []]),
          ),
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function reloadOptions(questionId: string) {
    if (!organizationId || !courseId || !moduleId || !quizId) return;
    const apiBase = '';
    const res = await fetch(
      `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes/${quizId}/questions/${questionId}/options`,
      { credentials: 'include' }
    );
    if (!res.ok) {
      throw new Error('OPTIONS_LOAD_FAILED');
    }
    const body: ListOptionsResponse = await res.json();
    setQuestionOptions((prev) => ({ ...prev, [questionId]: body.data ?? [] }));
  }

  function addInlineOption() {
    setInlineOptions((previous) => [...previous, { text: '', isCorrect: false }]);
  }

  function startAddingQuestion() {
    setInlineEditingQuestionId(null);
    setInlineQuestionText('');
    setInlineMarks('1');
    setInlineOptions([{ text: '', isCorrect: true }]);
    document.getElementById('inline-question-builder')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  async function editQuestionInBuilder(question: QuestionListItem) {
    if (!organizationId || !courseId || !moduleId || !quizId) return;

    const cachedOptions = questionOptions[question.id];
    setInlineEditingQuestionId(question.id);
    setInlineQuestionText(question.questionText);
    setInlineMarks(String(question.marks));
    setInlineOptions(
      cachedOptions?.map((option) => ({
        text: option.text,
        isCorrect: option.isCorrect,
      })) ?? [{ text: '', isCorrect: true }],
    );
    setExpandedQuestion(null);
    document.getElementById('inline-question-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (cachedOptions) return;

    try {
      const res = await fetch(
        `/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes/${quizId}/questions/${question.id}`,
        { credentials: 'include' },
      );
      const body: QuestionApiResponse = await res.json();
      if (!res.ok || !body.data) {
        toast.error(getQuizErrorMessage(body?.error));
        return;
      }
      setInlineQuestionText(body.data.questionText);
      setInlineMarks(String(body.data.marks));
      setInlineOptions(body.data.options.map((option) => ({
        text: option.text,
        isCorrect: option.isCorrect,
      })));
    } catch {
      toast.error(getQuizErrorMessage(null));
    }
  }

  async function saveInlineQuestion() {
    const questionTextValue = inlineQuestionText.trim();
    const options = inlineOptions.map((option) => ({ ...option, text: option.text.trim() })).filter((option) => option.text);
    if (!questionTextValue) {
      toast.error('Write a question first.');
      return;
    }
    const marksValue = Number(inlineMarks);
    if (!Number.isInteger(marksValue) || marksValue < 1) {
      toast.error('Enter marks of at least 1 for this question.');
      return;
    }
    if (options.length < 1) {
      toast.error('Add at least one option.');
      return;
    }
    if (!organizationId || !courseId || !moduleId || !quizId) return;

    setSavingInlineQuestion(true);
    try {
      const base = `/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes/${quizId}`;
      if (inlineEditingQuestionId) {
        const existingOptions = questionOptions[inlineEditingQuestionId] ?? [];
        const questionResponse = await fetch(`${base}/questions/${inlineEditingQuestionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ questionText: questionTextValue, marks: marksValue }),
        });
        if (!questionResponse.ok) {
          const code = (await questionResponse.json().catch(() => ({})))?.error;
          toast.error(getQuizErrorMessage(code));
          return;
        }
        const optionResponses = await Promise.all(
          options.map(async (option, index) => {
            const existing = existingOptions[index];
            const response = await fetch(
              existing
                ? `${base}/questions/${inlineEditingQuestionId}/options/${existing.id}`
                : `${base}/questions/${inlineEditingQuestionId}/options`,
              {
                method: existing ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ text: option.text, order: index, isCorrect: option.isCorrect }),
              },
            );
            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(body?.error ?? 'OPTION_UPDATE_FAILED');
            }
            return body.data as OptionItem;
          }),
        ).catch((error: unknown) => {
          toast.error(getQuizErrorMessage(error instanceof Error ? error.message : null));
          return null;
        });
        if (!optionResponses) return;
        setQuestions((previous) => previous?.map((item) =>
          item.id === inlineEditingQuestionId
            ? { ...item, questionText: questionTextValue, marks: marksValue }
            : item,
        ) ?? null);
        if (optionResponses.every(Boolean)) {
          setQuestionOptions((previous) => ({
            ...previous,
            [inlineEditingQuestionId]: optionResponses as OptionItem[],
          }));
        }
        setInlineEditingQuestionId(null);
        setInlineQuestionText('');
        setInlineMarks('1');
        setInlineOptions([{ text: '', isCorrect: true }]);
        toast.success('Question updated successfully.');
        return;
      }
      const questionResponse = await fetch(`${base}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          questionText: questionTextValue,
          marks: marksValue,
          order: questions?.length ?? 0,
          options,
        }),
      });
      if (!questionResponse.ok) {
        const code = (await questionResponse.json().catch(() => ({})))?.error;
        toast.error(getQuizErrorMessage(code));
        return;
      }
      const createdQuestion: QuestionApiResponse = await questionResponse.json();
      if (!createdQuestion.data?.id) {
        toast.error('Question was created but its ID was not returned.');
        return;
      }
      setInlineEditingQuestionId(null);
      setInlineQuestionText('');
      setInlineMarks('1');
      setInlineOptions([{ text: '', isCorrect: true }]);
      toast.success('Question and options saved successfully.');
      setQuestions((previous) => [
        ...(previous ?? []),
        createdQuestion.data as QuestionListItem,
      ]);
      setQuestionOptions((previous) => ({
        ...previous,
        [createdQuestion.data!.id]: createdQuestion.data!.options ?? [],
      }));
      window.setTimeout(() => {
        document.getElementById('inline-question-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    } catch {
      toast.error(getQuizErrorMessage(null));
    } finally {
      setSavingInlineQuestion(false);
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

  async function viewQuestion(questionId: string) {
    setExpandedQuestion(questionId);
    if (!questionOptions[questionId]) {
      setLoadingOptions(questionId);
      try {
        await reloadOptions(questionId);
      } catch {
        toast.error('Unable to load answer options.');
      } finally {
        setLoadingOptions(null);
      }
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
    <div className="quiz-theme relative mx-auto max-w-7xl px-3 pb-8 pt-3 sm:px-4 sm:pt-0 lg:px-6">
      <div className="mb-5 flex items-center justify-between gap-2 sm:flex-row sm:gap-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-[#2e7a74]">
          <span className="inline-flex h-2 w-2 rounded-full bg-[#2e7a74]" />
          Quizzes
        </div>
        <LinkButton
          href={`${dashboardPrefix}/courses/${courseId}/modules${organizationId ? `?organization=${organizationId}` : ''}`}
          variant="ghost"
          size="sm"
          className="shrink-0 whitespace-nowrap px-2.5 py-2 text-xs sm:px-3 sm:text-sm"
        >
          Back to Course Builder
        </LinkButton>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_360px]">
        <div className="order-2 min-w-0 self-start xl:order-1">
          {loading ? (
            <div className="mt-8 flex items-center gap-3 text-neutral-700">
              <Spinner size="md" label="Loading questions..." />
              <span>Loading questions...</span>
            </div>
          ) : questions !== null ? (
            <div>
              <div
                id="inline-question-builder"
                className="rounded-xl border border-[#dfece9] bg-[#f5ebdd] p-3 sm:p-4"
              >
                <div className="mb-4 flex items-end justify-between gap-4">
                  <h2 className="text-xl font-bold text-neutral-900">
                    Question {inlineEditingQuestionId
                      ? questions.findIndex((question) => question.id === inlineEditingQuestionId) + 1
                      : questions.length + 1}
                  </h2>
                  <div className="w-24 shrink-0 sm:w-28">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={inlineMarks}
                      onChange={(event) => setInlineMarks(event.target.value)}
                      placeholder="e.g. 5"
                      disabled={savingInlineQuestion}
                      required
                      className="h-10 py-2"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <Textarea
                    value={inlineQuestionText}
                    onChange={(event) => setInlineQuestionText(event.target.value)}
                    placeholder="What is the correct way to declare a variable in JavaScript?"
                    rows={3}
                    disabled={savingInlineQuestion}
                    required
                  />

                  <div>
                    <p className="mb-2 text-sm font-semibold text-neutral-800">Answer Options</p>
                    <div className="space-y-3">
                      {inlineOptions.map((option, index) => (
                        <div key={index} className="flex items-end gap-3">
                          <input
                            type="radio"
                            name="inline-correct-answer"
                            checked={option.isCorrect}
                            onChange={() => setInlineOptions((previous) => previous.map((item, itemIndex) => ({ ...item, isCorrect: itemIndex === index })))}
                            className="mb-3 h-5 w-5 shrink-0 accent-[#2e7a74]"
                            aria-label={`Mark option ${index + 1} as correct`}
                            disabled={savingInlineQuestion}
                          />
                          <div className="min-w-0 flex-1">
                            <Input
                              aria-label={`Option ${index + 1}`}
                              value={option.text}
                              onChange={(event) => setInlineOptions((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))}
                              placeholder={`Option ${index + 1}`}
                              disabled={savingInlineQuestion}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-[#e6ece9] pt-4 sm:flex-row sm:items-center sm:justify-end">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={addInlineOption}
                        disabled={savingInlineQuestion}
                        className="inline-flex w-fit shrink-0 items-center justify-center rounded-xl border border-[#b9793f] bg-[#f5ebdd] px-4 py-2.5 text-sm font-semibold text-[#5a321f] shadow-[0_3px_10px_rgb(90_50_31_/_0.14)] transition-colors hover:border-[#7a4a2e] hover:bg-[#ead8c6] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        + Add Option
                      </button>
                      <Button type="button" onClick={saveInlineQuestion} loading={savingInlineQuestion} disabled={savingInlineQuestion}>
                        {savingInlineQuestion ? 'Saving...' : 'Save Question'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {false && (questions?.length ?? 0) > 0 && (
                <div className="space-y-4">
                  {questions?.map((question) => (
                    <div id={`quiz-question-${question.id}`} key={question.id} className="scroll-mt-6 rounded-[24px] border border-[#e5e7e6] bg-[#fafcfb] p-4 shadow-[0_4px_20px_rgba(15,23,42,0.02)] sm:p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#edf7f5] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1f766d]">Q{question.order + 1}</span>
                            <span className="rounded-full border border-[#dfe8e5] bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600">{question.marks}</span>
                          </div>
                          <p className="text-base font-semibold text-neutral-900 sm:text-lg">{question.questionText}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => toggleOptions(question.id)}>
                            {expandedQuestion === question.id ? 'Hide' : 'View'}
                          </Button>
                          <button
                            type="button"
                            aria-label="Edit question"
                            title="Edit question"
                            onClick={() => openEditModal(question)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#e4e7e5] bg-white text-neutral-600 transition-colors hover:border-[#cfe7e3] hover:text-[#1f766d]"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            aria-label="Delete question"
                            title="Delete question"
                            onClick={() => handleDeleteQuestion(question.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#f1d9d9] bg-[#fff7f7] text-red-600 transition-colors hover:bg-red-50"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14H6L5 6" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v5M14 11v5" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {expandedQuestion === question.id && (
                        <div className="mt-4 rounded-2xl border border-[#e7ecea] bg-white p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Options</p>
                            <Button variant="primary" size="sm" onClick={() => openCreateOptionModal(question.id)}>
                              + Add Option
                            </Button>
                          </div>

                          {loadingOptions === question.id ? (
                            <div className="flex items-center gap-2 text-neutral-500">
                              <Spinner size="sm" label="Loading options..." />
                              <span className="text-sm">Loading options...</span>
                            </div>
                          ) : questionOptions[question.id] && questionOptions[question.id].length > 0 ? (
                            <div className="space-y-2">
                              {questionOptions[question.id].map((option, optionIndex) => (
                                <div key={option.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#ebefee] bg-[#fafcfc] px-3 py-2.5">
                                  <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${option.isCorrect ? 'border-[#2e7a74] bg-[#2e7a74] text-white' : 'border-[#d8dedb] bg-white text-neutral-600'}`}>
                                      {String.fromCharCode(65 + optionIndex)}
                                    </span>
                                    <span className="min-w-0 flex-1 text-sm text-neutral-800">{option.text}</span>
                                    {option.isCorrect ? (
                                      <Badge variant="success" size="sm">Correct</Badge>
                                    ) : null}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      aria-label="Edit option"
                                      title="Edit option"
                                      onClick={() => openEditOptionModal(question.id, option)}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-[#1f766d]"
                                    >
                                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      aria-label="Delete option"
                                      title="Delete option"
                                      onClick={() => handleDeleteOption(question.id, option.id)}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50"
                                    >
                                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14H6L5 6" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v5M14 11v5" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : questionOptions[question.id] && questionOptions[question.id].length === 0 ? (
                            <p className="text-sm text-neutral-500">No options yet. Add a few answer choices to complete this question.</p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <aside className="order-1 h-fit self-start rounded-[26px] border border-[#e3e6e3] bg-[#fcfdfd] p-4 shadow-[0_6px_24px_rgba(19,33,28,0.04)] sm:p-5 xl:order-2">
          <div className="flex items-center justify-between gap-2 border-b border-[#edf1ef] pb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Quiz Summary</p>
              <h3 className="mt-1 text-xl font-bold text-neutral-900">Overview</h3>
            </div>
            <span className="rounded-full bg-[#edf7f5] px-2.5 py-1 text-[11px] font-semibold text-[#1f766d]">{questions?.length ?? 0} Questions</span>
          </div>

          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-[#e9efed] bg-white p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-neutral-700">Questions</span>
                <span className="text-xs font-medium text-neutral-500">{questions?.length ?? 0} total</span>
              </div>
              {questions && questions.length > 0 ? (
                <div className="flex flex-wrap items-center justify-start gap-2">
                  {questions.map((question, index) => (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => void viewQuestion(question.id)}
                      aria-label={`View question ${index + 1}`}
                      className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold transition-colors ${expandedQuestion === question.id ? 'bg-[#5a321f] text-white shadow-[0_3px_10px_rgb(90_50_31_/_0.2)]' : 'bg-[#f5ebdd] text-[#5a321f] hover:bg-[#ead8c6]'}`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500">Add a question to view it here.</p>
              )}
            </div>

            <div className="space-y-2 border-t border-[#edf1ef] pt-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={startAddingQuestion}
                  disabled={savingInlineQuestion}
                  className="flex w-full items-center justify-center rounded-xl border border-[#b9793f] bg-[#f5ebdd] px-3 py-3 text-sm font-semibold text-[#5a321f] transition-colors hover:border-[#7a4a2e] hover:bg-[#ead8c6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add Question
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`${dashboardPrefix}/courses/${courseId}/modules/${moduleId}/quizzes${organizationId ? `?organization=${organizationId}` : ''}`)}
                  className="flex w-full items-center justify-center rounded-xl bg-[#2e7a74] px-3 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(46,122,116,0.25)] transition-colors hover:bg-[#255f5a]"
                >
                  Save Quiz
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {expandedQuestion && typeof document !== 'undefined' ? createPortal(
        <>
          <button
            type="button"
            aria-label="Close question drawer"
            onClick={() => setExpandedQuestion(null)}
            className="fixed inset-0 z-[1000] overscroll-none bg-neutral-950/30"
          />
          <aside className="fixed inset-y-0 right-0 z-[1010] flex h-dvh w-full max-w-md flex-col overscroll-contain border-l border-[#ead8c6] bg-[#fffdf9] shadow-2xl">
            {(() => {
              const question = questions?.find((item) => item.id === expandedQuestion);
              if (!question) return null;
              const questionIndex = questions?.findIndex((item) => item.id === question.id) ?? -1;
              return (
                <>
                  <div className="flex items-start justify-between gap-4 border-b border-[#ead8c6] p-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9b765c]">
                        Question {questionIndex + 1}
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-neutral-900">{question.questionText}</h2>
                      <p className="mt-1 text-sm text-neutral-500">{question.marks}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedQuestion(null)}
                      className="rounded-lg px-2 py-1 text-2xl leading-none text-neutral-500 hover:bg-neutral-100"
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Answer options</p>
                    {loadingOptions === question.id ? (
                      <div className="flex items-center gap-2 text-neutral-500">
                        <Spinner size="sm" label="Loading options..." />
                        <span className="text-sm">Loading options...</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(questionOptions[question.id] ?? []).map((option, index) => (
                          <div key={option.id} className="rounded-xl border border-[#e7ecea] bg-white p-3">
                            <div className="flex items-start gap-3">
                              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${option.isCorrect ? 'bg-[#2e7a74] text-white' : 'bg-[#f5ebdd] text-[#5a321f]'}`}>
                                {String.fromCharCode(65 + index)}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm text-neutral-800">{option.text}</p>
                                {option.isCorrect && <p className="mt-1 text-xs font-semibold text-[#2e7a74]">Correct answer</p>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 border-t border-[#ead8c6] p-5">
                    <Button
                      type="button"
                      variant="primary"
                      className="flex-1"
                      onClick={() => void editQuestionInBuilder(question)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="flex-1"
                      onClick={() => setExpandedQuestion(null)}
                    >
                      Close
                    </Button>
                  </div>
                </>
              );
            })()}
          </aside>
        </>,
        document.body,
      ) : null}

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
              className="h-10 py-2"
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
