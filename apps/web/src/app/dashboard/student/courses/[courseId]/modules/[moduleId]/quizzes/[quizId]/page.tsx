'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Badge,
  Button,
  ErrorState,
  Spinner,
} from '@/components/ui';
import { getQuizErrorMessage } from '@/features/course/quizErrors';
import { useToast } from '@/components/ui/ToastProvider';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { getNextContentUrl } from '@/features/student/nextContent';

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
  activeAttempt: ActiveAttempt | null;
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
  totalQuestions: number;
  attemptsRemaining: number | null;
};

type ActiveAttempt = {
  attemptId: string;
  attemptNumber: number;
  startedAt: string;
  expiresAt: string | null;
};

export default function StudentQuizTakingPage() {
  const params = useParams();
  const courseId = typeof params.courseId === 'string' ? params.courseId : null;
  const moduleId = typeof params.moduleId === 'string' ? params.moduleId : null;
  const quizId = typeof params.quizId === 'string' ? params.quizId : null;
  const router = useRouter();
  const toast = useToast();
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [quiz, setQuiz] = useState<QuizForTaking | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<ActiveAttempt | null>(null);
  const [started, setStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [expired, setExpired] = useState(false);
  const [courseCompleted, setCourseCompleted] = useState(false);

  async function loadQuiz(orgId: string, cid: string, mid: string, qid: string) {
    try {
      const apiBase = '';
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
      const attempt = body.data?.activeAttempt as ActiveAttempt | null | undefined;
      if (attempt?.attemptId) {
        setActiveAttempt(attempt);
        setStarted(true);
        setExpired(Boolean(attempt.expiresAt && new Date(attempt.expiresAt).getTime() <= Date.now()));
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    }
  }

  // Check auth and set organizationId
  useEffect(() => {
    if (userLoading) return;
    
    if (!user) {
      window.location.href = '/login';
      return;
    }
    
    if (user.role !== 'STUDENT') {
      window.location.href = '/login';
      return;
    }
    
    const orgId = user.organizationId ?? null;
    if (!orgId) {
      window.location.href = '/login';
      return;
    }
    
    setOrganizationId(orgId);
  }, [user, userLoading, courseId, moduleId, quizId]);

  // Load quiz data
  useEffect(() => {
    if (!organizationId || !courseId || !moduleId || !quizId) {
      return;
    }
    let active = true;

    async function load() {
      try {
        await loadQuiz(organizationId ?? '', courseId ?? '', moduleId ?? '', quizId ?? '');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [organizationId, courseId, moduleId, quizId]);

  async function startAttempt() {
    if (!organizationId || !courseId || !moduleId || !quizId || !quiz || starting) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/organizations/${organizationId}/student/courses/${courseId}/modules/${moduleId}/quizzes/${quizId}/attempts/start`,
        { method: 'POST', credentials: 'include' },
      );
      const body = await res.json();
      if (!res.ok) {
        setError(getQuizErrorMessage(body?.error));
        return;
      }
      const attempt = body.data as ActiveAttempt;
      setActiveAttempt(attempt);
      setStarted(true);
      setCurrentQuestion(0);
    } catch {
      setError('Could not start the quiz. Please try again.');
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    if (!started || !activeAttempt?.expiresAt) return;
    const updateRemaining = () => {
      const seconds = Math.max(0, Math.ceil((new Date(activeAttempt.expiresAt!).getTime() - Date.now()) / 1000));
      setRemainingSeconds(seconds);
      if (seconds === 0) setExpired(true);
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [started, activeAttempt]);

  useEffect(() => {
    if (userLoading || organizationId) return;
    if (user && user.role === 'STUDENT' && user.organizationId && (!courseId || !moduleId || !quizId)) {
      setError('The quiz link is incomplete. Please return to the module and open the quiz again.');
      setLoading(false);
    }
  }, [user, userLoading, organizationId, courseId, moduleId, quizId]);

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
      const apiBase = '';
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
      if (body.data?.passed && organizationId && courseId && moduleId && quizId) {
        const progressResponse = await fetch(
          `/api/v1/organizations/${organizationId}/student/courses/${courseId}/progress`,
          { credentials: 'include' },
        );
        if (progressResponse.ok) {
          const progressBody = await progressResponse.json();
          const completed = progressBody.data?.successfulCompletion === true;
          setCourseCompleted(completed);
          if (completed) {
            toast.success('Congratulations! You completed the entire course.');
          }
        }
        const nextUrl = await getNextContentUrl({
          organizationId,
          courseId,
          moduleId,
          contentType: 'QUIZ',
          contentId: quizId,
        });
        if (nextUrl) {
          toast.success('Quiz passed! Moving to the next learning item.');
          window.setTimeout(() => router.push(nextUrl), 1800);
        }
      }
    } catch {
      toast.error('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function retryAttempt() {
    setResult(null);
    setAnswers({});
    setActiveAttempt(null);
    setStarted(false);
    setExpired(false);
    setCurrentQuestion(0);
    void startAttempt();
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
  const question = quiz?.questions[currentQuestion];
  const isLastQuestion = currentQuestion === totalQuestions - 1;
  const formattedTime = remainingSeconds == null
    ? null
    : `${Math.floor(remainingSeconds / 60).toString().padStart(2, '0')}:${(remainingSeconds % 60).toString().padStart(2, '0')}`;

  return (
    <div className="mx-auto w-full max-w-6xl px-1 sm:px-2">
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
          <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-[#ead8c6] bg-white shadow-[0_12px_35px_rgba(90,50,31,0.08)]">
            <div className={`relative overflow-hidden p-5 sm:p-9 ${result.passed ? 'bg-[#fff9f0]' : 'bg-[#fdf3ef]'}`}>
              <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-[#f5ebdd]" />
              <div className="flex items-start gap-3">
                <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${result.passed ? 'bg-[#5a321f] text-white' : 'bg-[#a94442] text-white'}`}>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {result.passed ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  )}
                  </svg>
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase tracking-[0.16em] ${result.passed ? 'text-[#7a4a2e]' : 'text-[#a94442]'}`}>
                    {result.passed ? 'Quiz passed' : 'Quiz not passed'}
                  </p>
                  <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#17212b] sm:text-3xl">
                    {courseCompleted ? 'Course completed!' : result.passed ? 'Congratulations!' : 'Keep practicing'}
                  </h1>
                </div>
              </div>
              <p className="relative mt-4 text-sm leading-6 text-[#5f6368] sm:ml-[3.5rem]">
                {courseCompleted ? (
                  'Amazing work! You successfully completed all modules in this course.'
                ) : (
                  <>
                    You scored {result.percentage}% and {result.passed ? 'met' : 'did not meet'} the passing threshold
                    {result.passingPercentage != null ? ` of ${result.passingPercentage}%` : ''}.
                  </>
                )}
              </p>
            </div>

            <div className="p-5 sm:p-9">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-[#ead8c6] bg-[#fffdf9] p-4 text-center">
                  <div className="text-2xl font-bold text-[#5a321f]">{result.score} / {result.totalMarks}</div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-wide text-[#9b765c]">Score</div>
                </div>
                <div className="rounded-2xl border border-[#d9eadf] bg-[#f4fbf6] p-4 text-center">
                  <div className="text-2xl font-bold text-[#16834b]">{result.correctCount}</div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-wide text-[#6b8d78]">Correct</div>
                </div>
                <div className="rounded-2xl border border-[#f0d7d4] bg-[#fff8f7] p-4 text-center">
                  <div className="text-2xl font-bold text-[#c63d3d]">{result.incorrectCount}</div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-wide text-[#a47772]">Incorrect</div>
                </div>
                <div className="rounded-2xl border border-[#ead8c6] bg-[#f5ebdd] p-4 text-center">
                  <div className="text-2xl font-bold text-[#5a321f]">{result.percentage}%</div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-wide text-[#9b765c]">Percentage</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[#ead8c6] bg-[#fffdf9] px-4 py-3 text-center text-sm text-[#6d625a] sm:text-left">
                Attempt {result.attemptNumber} of {quiz.maxAttempts ?? 'unlimited'}
                <span className="mx-2 text-neutral-300">•</span>
                {result.correctCount} of {result.totalQuestions} questions correct
                {result.attemptsRemaining != null && (
                  <>
                    <span className="mx-2 text-neutral-300">•</span>
                    {result.attemptsRemaining} attempt{result.attemptsRemaining !== 1 ? 's' : ''} remaining
                  </>
                )}
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div />
                {courseCompleted && result.passed && (
                  <Link
                    href="/dashboard/student/certificates"
                    className="inline-flex items-center justify-center rounded-lg bg-[#5A321F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#472719]"
                  >
                    Go to Certificate
                  </Link>
                )}
                {!result.passed && (result.attemptsRemaining == null || result.attemptsRemaining > 0) && (
                  <Button className="w-full sm:w-auto" variant="primary" onClick={retryAttempt} loading={starting}>
                    Retry Quiz
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {quiz && !result && attemptsRemaining !== 0 && !started ? (
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

            <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-neutral-500">Ready to begin?</p>
                  <p className="mt-1 text-sm text-neutral-600">Your attempt and timer start when you click the button.</p>
                </div>
                <Button variant="primary" onClick={startAttempt} loading={starting}>
                  Start Quiz
                </Button>
              </div>
            </div>
          </>
        ) : null}

        {quiz && !result && started && question && !expired ? (
          <>
            <div className="grid min-w-0 gap-3 md:grid-cols-[180px_minmax(0,1fr)] xl:grid-cols-[170px_minmax(0,1fr)_200px]">
              <aside className="min-w-0 rounded-xl border border-neutral-200 bg-[#fffdf9] p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-[#475569]">
                  <span>Questions</span>
                  <span>{answeredCount} / {totalQuestions}</span>
                </div>
                <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-5">
                  {quiz.questions.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCurrentQuestion(index)}
                      className={`h-8 min-w-0 rounded-md border text-xs font-medium ${
                        index === currentQuestion
                          ? 'border-[#5a321f] bg-[#5a321f] text-white'
                          : answers[item.id]
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border-neutral-200 bg-white text-neutral-600'
                      }`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </aside>

              <main className="min-w-0 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-[#f5ebdd] px-3 py-1 text-xs font-medium text-[#5a321f]">
                    Question {currentQuestion + 1} of {totalQuestions}
                  </span>
                  <span className="text-xs text-[#64748b]">{question.marks} mark{question.marks !== 1 ? 's' : ''}</span>
                </div>
                <h2 className="break-words text-base font-semibold leading-6 text-[#17212b]">{question.questionText}</h2>
                <div className="mt-5 space-y-2">
                  {question.options.map((option, index) => {
                    const selected = answers[question.id] === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => selectOption(question.id, option.id)}
                        className={`min-h-11 w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                          selected ? 'border-[#c8a98f] bg-[#fff7ee]' : 'border-neutral-200 bg-white hover:border-[#c8a98f]'
                        }`}
                      >
                        <span className="flex items-center gap-3 break-words text-xs text-[#475569]">
                          <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${selected ? 'border-[#5a321f] bg-[#5a321f]' : 'border-neutral-300'}`}>
                            {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                          <span className="font-semibold">{String.fromCharCode(65 + index)}.</span>
                          <span>{option.text}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
                  <Button variant="secondary" size="sm" onClick={() => setCurrentQuestion((index) => Math.max(0, index - 1))} disabled={currentQuestion === 0 || submitting}>
                    ← Previous
                  </Button>
                  {isLastQuestion ? (
                    <Button variant="primary" size="sm" onClick={submitAttempt} loading={submitting} disabled={answeredCount !== totalQuestions}>
                      Submit Quiz
                    </Button>
                  ) : (
                    <Button variant="primary" size="sm" onClick={() => setCurrentQuestion((index) => index + 1)} disabled={!answers[question.id] || submitting}>
                      Next →
                    </Button>
                  )}
                </div>
              </main>

              <aside className="min-w-0 rounded-xl border border-neutral-200 bg-[#fffdf9] p-4 md:col-span-2 xl:col-span-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#475569]">
                  <span className="text-lg text-[#5a321f]">◷</span> Time Remaining
                </div>
                <p className="mt-1 text-xl font-bold text-[#5a321f]">{formattedTime ?? '--:--'}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f1e8dc]">
                  <div className="h-full rounded-full bg-[#5a321f]" style={{ width: `${remainingSeconds != null && quiz.timeLimitMinutes ? Math.min(100, (remainingSeconds / (quiz.timeLimitMinutes * 60)) * 100) : 0}%` }} />
                </div>
                <div className="mt-5 space-y-2 border-t border-neutral-100 pt-4 text-xs text-[#64748b]">
                  <div className="flex justify-between"><span>Total Questions</span><b>{totalQuestions}</b></div>
                  <div className="flex justify-between"><span>Answered</span><b>{answeredCount}</b></div>
                  <div className="flex justify-between"><span>Remaining</span><b>{totalQuestions - answeredCount}</b></div>
                </div>
              </aside>
            </div>
          </>
        ) : null}

        {quiz && !result && started && expired ? (
          <div className="rounded-2xl border border-warning-200 bg-warning-50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-warning-900">Time is up</h2>
            <p className="mt-2 text-sm text-warning-800">Your quiz attempt has expired. Please reload to view the latest attempt state.</p>
          </div>
        ) : null}
        {quiz && !result && attemptsRemaining === 0 ? (
          <div className="rounded-2xl border border-warning-200 bg-warning-50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-warning-900">No attempts remaining</h2>
            <p className="mt-2 text-sm text-warning-800">
              You have used all allowed attempts for this quiz.
            </p>
          </div>
        ) : null}
      </div>
  );
}
