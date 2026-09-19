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

export default function CreateQuizPage() {
  const params = useParams();
  const courseId = typeof params.courseId === 'string' ? params.courseId : null;
  const moduleId = typeof params.moduleId === 'string' ? params.moduleId : null;
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const dashboardPrefix = pathname.startsWith('/dashboard/instructor') ? '/dashboard/instructor' : '/dashboard/organization';
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
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

  async function handleCreate() {
    if (!validate() || !organizationId || !courseId || !moduleId) return;
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        order: Number(order),
        timeLimitMinutes: Number(timeLimitMinutes),
        maxAttempts: Number(maxAttempts),
      };
      if (description.trim()) body.description = description.trim();
      if (passingPercentage.trim()) body.passingPercentage = Number(passingPercentage);
      const response = await fetch(`/api/v1/organizations/${organizationId}/courses/${courseId}/modules/${moduleId}/quizzes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        let code: unknown = null;
        try { code = (await response.json())?.error; } catch { code = null; }
        toast.error(getQuizErrorMessage(code));
        return;
      }
      const created: { data?: { id?: string } } = await response.json();
      if (!created.data?.id) {
        toast.error('Quiz was created but its ID was not returned.');
        return;
      }
      toast.success('Quiz saved as a draft. Add questions and options to continue.');
      router.push(`${dashboardPrefix}/courses/${courseId}/modules/${moduleId}/quizzes/${created.data.id}/questions${organizationId ? `?organization=${organizationId}` : ''}`);
    } catch {
      toast.error(getQuizErrorMessage(null));
    } finally {
      setCreating(false);
    }
  }

  if (userLoading || !organizationId) {
    return <div className="flex items-center justify-center py-16"><Spinner size="lg" label="Loading..." /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Create Quiz</p>
        <LinkButton href={`${dashboardPrefix}/courses/${courseId}/modules/${moduleId}/quizzes${organizationId ? `?organization=${organizationId}` : ''}`} variant="ghost" size="sm">
          Back to Quizzes
        </LinkButton>
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <QuizSteps active="details" />
        <h1 className="text-2xl font-bold text-neutral-900">Create Quiz</h1>
        <p className="mt-1 text-sm text-neutral-500">Set the quiz details before adding questions and options.</p>
        <div className="mt-6 space-y-5">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} placeholder="e.g. Module 1 Quiz" required disabled={creating} />
          <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={3} disabled={creating} />
          <Input label="Order" type="number" min="0" step="1" value={order} onChange={(e) => setOrder(e.target.value)} error={errors.order} placeholder="e.g. 0" required disabled={creating} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Time Limit (min)" type="number" min="1" step="1" value={timeLimitMinutes} onChange={(e) => setTimeLimitMinutes(e.target.value)} error={errors.timeLimit} placeholder="e.g. 30" required disabled={creating} />
            <Input label="Passing %" type="number" min="0" max="100" step="0.5" value={passingPercentage} onChange={(e) => setPassingPercentage(e.target.value)} error={errors.passing} placeholder="e.g. 70" disabled={creating} />
            <Input label="Max Attempts" type="number" min="1" step="1" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} error={errors.attempts} placeholder="e.g. 3" required disabled={creating} />
          </div>
          <div className="flex justify-end gap-3 border-t border-neutral-200 pt-5">
            <LinkButton href={`${dashboardPrefix}/courses/${courseId}/modules/${moduleId}/quizzes${organizationId ? `?organization=${organizationId}` : ''}`} variant="ghost" disabled={creating}>Cancel</LinkButton>
            <Button type="button" onClick={handleCreate} loading={creating} disabled={creating}>Save Quiz</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
