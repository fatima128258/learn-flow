'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Button, Spinner } from '@/components/ui';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/forms/Textarea';
import { LinkButton } from '@/components/ui/LinkButton';
import { useToast } from '@/components/ui/ToastProvider';
import { getQuizErrorMessage } from '@/features/course/quizErrors';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { QuizSteps } from '@/components/forms/QuizSteps';

type QuizResponse = {
  data?: {
    title: string;
    description: string | null;
    order: number;
    timeLimitMinutes: number | null;
    passingPercentage: number | null;
    maxAttempts: number | null;
  };
  error?: string;
};

export default function QuizDetailsPage() {
  const params = useParams();
  const courseId = typeof params.courseId === 'string' ? params.courseId : null;
  const moduleId = typeof params.moduleId === 'string' ? params.moduleId : null;
  const quizId = typeof params.quizId === 'string' ? params.quizId : null;
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const dashboardPrefix = pathname.startsWith('/dashboard/instructor') ? '/dashboard/instructor' : '/dashboard/organization';
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('');
  const [passingPercentage, setPassingPercentage] = useState('');
  const [maxAttempts, setMaxAttempts] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (userLoading) return;
    if (user?.role !== 'ORG_ADMIN' && user?.role !== 'INSTRUCTOR') {
      window.location.href = '/login';
      return;
    }
    if (!user.organizationId) {
      window.location.href = '/login';
      return;
    }
    setOrganizationId(user.organizationId);
  }, [user, userLoading]);

  useEffect(() => {
    if (!organizationId || !courseId || !moduleId || !quizId) return;
    let active = true;

    async function loadQuiz() {
      setLoading(true);
      try {
        const response = await fetch(`/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes/${quizId}`, {
          credentials: 'include',
        });
        const body: QuizResponse = await response.json();
        if (!response.ok || !body.data) {
          toast.error(getQuizErrorMessage(body.error));
          return;
        }
        if (!active) return;
        setTitle(body.data.title);
        setDescription(body.data.description ?? '');
        setOrder(String(body.data.order));
        setTimeLimitMinutes(body.data.timeLimitMinutes === null ? '' : String(body.data.timeLimitMinutes));
        setPassingPercentage(body.data.passingPercentage === null ? '' : String(body.data.passingPercentage));
        setMaxAttempts(body.data.maxAttempts === null ? '' : String(body.data.maxAttempts));
      } catch {
        if (active) toast.error(getQuizErrorMessage(null));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadQuiz();
    return () => {
      active = false;
    };
  }, [organizationId, courseId, moduleId, quizId, toast]);

  function validate() {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = 'Title is required';
    if (order.trim() === '' || !Number.isInteger(Number(order)) || Number(order) < 0) next.order = 'Order must be a non-negative integer';
    if (timeLimitMinutes.trim() === '' || !Number.isInteger(Number(timeLimitMinutes)) || Number(timeLimitMinutes) < 1) next.timeLimit = 'Time limit must be a positive integer';
    if (passingPercentage.trim() !== '' && (Number(passingPercentage) < 0 || Number(passingPercentage) > 100)) next.passing = 'Passing percentage must be between 0 and 100';
    if (maxAttempts.trim() === '' || !Number.isInteger(Number(maxAttempts)) || Number(maxAttempts) < 1) next.attempts = 'Max attempts must be a positive integer';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function saveQuiz() {
    if (!validate() || !organizationId || !courseId || !moduleId || !quizId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes/${quizId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          order: Number(order),
          timeLimitMinutes: Number(timeLimitMinutes),
          passingPercentage: passingPercentage.trim() ? Number(passingPercentage) : null,
          maxAttempts: Number(maxAttempts),
        }),
      });
      if (!response.ok) {
        const body: QuizResponse = await response.json().catch(() => ({}));
        toast.error(getQuizErrorMessage(body.error));
        return;
      }
      toast.success('Quiz saved as a draft.');
      router.push(`${dashboardPrefix}/courses/${courseId}/modules/${moduleId}/quizzes/${quizId}/questions${organizationId ? `?organization=${organizationId}` : ''}`);
    } catch {
      toast.error(getQuizErrorMessage(null));
    } finally {
      setSaving(false);
    }
  }

  if (userLoading || loading || !organizationId) {
    return <div className="flex items-center gap-3 text-neutral-700"><Spinner size="md" label="Loading quiz details..." /><span>Loading quiz details...</span></div>;
  }

  const quizzesHref = `${dashboardPrefix}/courses/${courseId}/modules/${moduleId}/quizzes${organizationId ? `?organization=${organizationId}` : ''}`;
  const questionsHref = `${dashboardPrefix}/courses/${courseId}/modules/${moduleId}/quizzes/${quizId}/questions${organizationId ? `?organization=${organizationId}` : ''}`;

  return (
    <div className="quiz-theme mx-auto max-w-3xl px-3 pb-8 pt-3 sm:px-4">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#5a321f]">Quiz Details</p>
        <LinkButton href={quizzesHref} variant="ghost" size="sm">Back to Quizzes</LinkButton>
      </div>
      <div className="rounded-2xl border border-[#e3e6e3] bg-white p-6 shadow-sm">
        <QuizSteps active="details" questionsHref={questionsHref} />
        <h1 className="text-2xl font-bold text-neutral-900">Quiz Details</h1>
        <p className="mt-1 text-sm text-neutral-500">Review the title, description, and quiz settings before adding questions.</p>
        <div className="mt-6 space-y-5">
          <Input label="Title" value={title} onChange={(event) => setTitle(event.target.value)} error={errors.title} required disabled={saving} />
          <Textarea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} disabled={saving} />
          <Input label="Order" type="number" min="0" step="1" value={order} onChange={(event) => setOrder(event.target.value)} error={errors.order} required disabled={saving} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Time Limit (min)" type="number" min="1" step="1" value={timeLimitMinutes} onChange={(event) => setTimeLimitMinutes(event.target.value)} error={errors.timeLimit} required disabled={saving} />
            <Input label="Passing %" type="number" min="0" max="100" step="0.5" value={passingPercentage} onChange={(event) => setPassingPercentage(event.target.value)} error={errors.passing} disabled={saving} />
            <Input label="Max Attempts" type="number" min="1" step="1" value={maxAttempts} onChange={(event) => setMaxAttempts(event.target.value)} error={errors.attempts} required disabled={saving} />
          </div>
          <div className="flex justify-end gap-3 border-t border-[#ead8c6] pt-5">
            <LinkButton href={quizzesHref} variant="ghost" disabled={saving}>Close</LinkButton>
            <Button type="button" onClick={saveQuiz} loading={saving} disabled={saving}>Save Quiz</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
