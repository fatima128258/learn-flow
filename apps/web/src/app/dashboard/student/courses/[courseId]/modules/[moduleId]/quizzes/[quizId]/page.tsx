'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Badge,
  Button,
  ErrorState,
  Spinner,
} from '@/components/ui';
import { PageHeader } from '@/components/dashboard';
import { getQuizErrorMessage } from '@/features/course/quizErrors';
import { useToast } from '@/components/ui/ToastProvider';

type MeResponse = {
  user?: {
    id?: string;
    name?: string | null;
    email?: string;
    role?: string | null;
    organizationId?: string | null;
  };
};

type QuizOption = {
  id: string;
  text: string;
  order: number;
};

type QuizQuestion = {
  id: string;
  questionText: string;
  marks: number;
  order: number;
  options: QuizOption[];
};

type QuizForTaking = {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  timeLimitMinutes: number | null;
  passingPercentage: number | null;
  maxAttempts: number | null;
  order: number;
  questions: QuizQuestion[];
  attempts: {
    used: number;
    remaining: number | null;
  };
};

type AttemptResult = {
  attemptId: string;
  attemptNumber: number;
  score: number;
  correctCount: number;
  incorrectCount: number;
  percentage: number;
  passed: boolean;
  submittedAt: string;
  passingPercentage: number | null;
  totalMarks: number;
};

export default function StudentQuizTakingPage() {
  const params = useParams();
  const courseId = typeof params.courseId === 'string' ? params.courseId : null;
  const moduleId = typeof params.moduleId === 'string' ? params.moduleId : null;
  const quizId = typeof params.quizId === 'string' ? params.quizId : null;
  const toast = useToast();

  const [quiz, setQuiz] = useState<QuizForTaking | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  async function loadQuiz(orgId: string, cid: string, mid: string, qid: string) {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${orgId}/student/courses/${cid}/modules/${mid}/quizzes/${qid}`,
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
      const body = await res.json();
      setQuiz(body.data ?? null);
    } catch {
      setError('Could not reach the server. Please try again.');
    }
  }

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
        if (meData.user?.role !== 'STUDENT') {
          window.location.href = '/login';
          return;
        }
        const orgId = meData.user?.organizationId ?? null;
        if (!orgId) {
          window.location.href = '/login';
          return;
        }
        setOrganizationId(orgId);
        if (courseId && moduleId && quizId) {
          await loadQuiz(orgId, courseId, moduleId, quizId);
        }
      } catch {
        if (active) window.location.href = '/login';
      } finally {
        if (active) setLoading(false);
      }
    }

    guard();
    return () => {
      active = false;
    };
  }, [courseId, moduleId, quizId]);

  function selectOption(questionId: string, optionId: string) {
    if (result) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }

  async function submitAttempt() {
    if (!quiz || !organizationId || !courseId || !moduleId || !quizId) return;
    if (quiz.questions.some((q) => !answers[q.id])) {
      toast.error(getQuizErrorMessage('ALL_QUESTIONS_REQUIRED'));
      return;
    }
    setSubmitting(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/student/courses/${courseId}/modules/${moduleId}/quizzes/${quizId}/attempts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            answers: quiz.questions.map((q) => ({
              questionId: q.id,
              optionId: answers[q.id],
            })),
          }),
        }
      );
      const body = await res.json();
      if (!res.ok) {
        toast.error(getQuizErrorMessage(body?.error));
        return;
      }
      setResult(body.data ?? null);
    } catch {
      toast.error('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-5xl items-center gap-3 text-neutral-700">
        <Spinner size="lg" label="Loading quiz..." />
        <span>Loading quiz...</span>
      </div>
    );
  }

  const attemptsRemaining = quiz?.attempts.remaining ?? null;
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = quiz?.questions.length ?? 0;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        subtitle="Student"
        title="Quiz"
          breadcrumbs={
            <div className="flex items-center gap-2 text-sm">
              <Link href="/dashboard/student" className="text-primary-600 hover:text-primary-700">My Courses</Link>
              <span className="text-neutral-400">/</span>
              {quiz && (
                <>
                  <Link href={`/dashboard/student/courses/${courseId}`} className="text-primary-600 hover:text-primary-700">
                    Course
                  </Link>
                  <span className="text-neutral-400">/</span>
                  <Link href={`/dashboard/student/courses/${courseId}/modules/${moduleId}`} className="text-primary-600 hover:text-primary-700">
                    Module
                  </Link>
                  <span className="text-neutral-400">/</span>
                </>
              )}
              <span className="text-neutral-600">{quiz?.title ?? 'Quiz'}</span>
            </div>
          }
        />

        {error && !quiz && (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState
              title="Unable to load quiz"
              message={error}
            />
          </div>
        )}

        {!quiz && !error && (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState title="Quiz not found" message="This quiz could not be found." />
          </div>
        )}

        {quiz && result ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className={`p-6 ${result.passed ? 'bg-success-50' : 'bg-error-50'}`}>
              <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${result.passed ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700'}`}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {result.passed ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  )}
                </svg>
                {result.passed ? 'Passed' : 'Failed'}
              </div>
              <h1 className="mt-3 text-2xl font-bold text-neutral-900">
                {result.passed ? 'Congratulations!' : 'Quiz not passed'}
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                You scored {result.percentage}% and {result.passed ? 'met' : 'did not meet'} the passing threshold
                {result.passingPercentage != null ? ` of ${result.passingPercentage}%` : ''}.
              </p>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-neutral-200 p-4 text-center">
                  <div className="text-2xl font-bold text-neutral-900">{result.score} / {result.totalMarks}</div>
                  <div className="text-sm text-neutral-500">Score</div>
                </div>
                <div className="rounded-xl border border-neutral-200 p-4 text-center">
                  <div className="text-2xl font-bold text-success-600">{result.correctCount}</div>
                  <div className="text-sm text-neutral-500">Correct</div>
                </div>
                <div className="rounded-xl border border-neutral-200 p-4 text-center">
                  <div className="text-2xl font-bold text-error-600">{result.incorrectCount}</div>
                  <div className="text-sm text-neutral-500">Incorrect</div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href={`/dashboard/student/courses/${courseId}/modules/${moduleId}`}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  &larr; Back to Module
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {quiz && !result ? (
          <>
            <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant="primary" size="sm">Quiz</Badge>
                {quiz.timeLimitMinutes != null && (
                  <Badge variant="default" size="sm">{quiz.timeLimitMinutes} min</Badge>
                )}
                {quiz.passingPercentage != null && (
                  <Badge variant="warning" size="sm">Pass {quiz.passingPercentage}%</Badge>
                )}
                {attemptsRemaining != null && (
                  <Badge variant="info" size="sm">
                    {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} left
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold text-neutral-900">{quiz.title}</h1>
              {quiz.description && (
                <p className="mt-2 text-neutral-600">{quiz.description}</p>
              )}
              <p className="mt-3 text-sm text-neutral-500">
                {totalQuestions} question{totalQuestions !== 1 ? 's' : ''}
                {quiz.timeLimitMinutes != null && ` · ${quiz.timeLimitMinutes} minute time limit`}
                {quiz.passingPercentage != null && ` · passing score ${quiz.passingPercentage}%`}
              </p>
            </div>

            <div className="space-y-4">
              {quiz.questions.map((question, qIndex) => (
                <div key={question.id} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-neutral-900">
                      <span className="mr-2 text-neutral-400">{qIndex + 1}.</span>
                      {question.questionText}
                    </h3>
                    <Badge variant="default" size="sm">{question.marks} pt{question.marks !== 1 ? 's' : ''}</Badge>
                  </div>

                  <div className="space-y-2">
                    {question.options.map((option) => {
                      const selected = answers[question.id] === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => selectOption(question.id, option.id)}
                          className={`w-full rounded-xl border p-3 text-left transition-colors ${selected
                            ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500'
                            : 'border-neutral-200 bg-white hover:border-primary-300 hover:bg-neutral-50'
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border ${
                              selected ? 'border-primary-500 bg-primary-500' : 'border-neutral-300 bg-white'
                            }`}>
                              {selected && (
                                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                            <span className="text-sm text-neutral-800">{option.text}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm text-neutral-500">
                  Answered {answeredCount} of {totalQuestions} question{totalQuestions !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => setAnswers({})}
                    disabled={submitting}
                  >
                    Reset
                  </Button>
                  <Button
                    variant="primary"
                    onClick={submitAttempt}
                    loading={submitting}
                    disabled={answeredCount === 0}
                  >
                    Submit Quiz
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
  );
}
