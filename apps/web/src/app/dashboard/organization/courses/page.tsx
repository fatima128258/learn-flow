'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge, Drawer, EmptyState, EmptyStateIcons, Spinner } from '../../../../components/ui';
import { LinkButton } from '../../../../components/ui/LinkButton';
import { getListCoursesErrorMessage } from '../../../../features/course/listCoursesErrors';
import { getCourseStatusErrorMessage } from '../../../../features/course/courseStatusErrors';
import { useToast } from '../../../../components/ui/ToastProvider';
import {
  PageHeader,
  TableCard,
  tableHeadClass,
  tableCellClass,
  tableRowHoverClass,
  CourseActionsMenu,
} from '../../../../components/dashboard';
import { useCurrentUser } from '../../../../features/auth/useCurrentUser';

// ─── Types ────────────────────────────────────────────────────────────────────

type CourseListItem = {
  id: string;
  title: string;
  slug: string;
  status: string;
  difficulty: string | null;
  createdAt: string;
};

type CourseContent = CourseListItem & {
  description: string | null;
  category: string | null;
  estimatedMinutes: number | null;
  learningObjectives: string[];
};
type CourseLesson = { id: string; title: string; description: string | null; content: string | null; type: string | null; duration: number | null; order: number };
type CourseOption = { id: string; text: string; isCorrect: boolean; order: number };
type CourseQuestion = { id: string; questionText: string; marks: number; order: number; options: CourseOption[] };
type CourseQuiz = { id: string; title: string; description: string | null; order: number; timeLimitMinutes: number | null; passingPercentage: number | null; maxAttempts: number | null; questions: CourseQuestion[] };
type CourseModule = { id: string; title: string; description: string | null; order: number; lessons: CourseLesson[]; quizzes: CourseQuiz[] };
type CourseDrawerData = { course: CourseContent; modules: CourseModule[] };

type CourseStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';

type ListCoursesResponse = {
  success?: boolean;
  data?: CourseListItem[];
  error?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: CourseStatus; label: string; description: string }[] = [
  { value: 'PUBLISHED', label: 'Published',  description: 'Visible to enrolled students' },
  { value: 'DRAFT',     label: 'Draft',      description: 'Not visible to students' },
  { value: 'REVIEW',    label: 'In Review',  description: 'Pending approval' },
  { value: 'ARCHIVED',  label: 'Archived',   description: 'Hidden from all students' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadgeVariant(status: string) {
  if (status === 'PUBLISHED') return 'success' as const;
  if (status === 'REVIEW')    return 'warning' as const;
  if (status === 'ARCHIVED')  return 'default' as const;
  return 'warning' as const; // DRAFT
}

// ─── Change-Status Modal ──────────────────────────────────────────────────────

interface ChangeStatusModalProps {
  course: CourseListItem;
  organizationId: string;
  onClose: () => void;
  onSuccess: (courseId: string, newStatus: CourseStatus) => void;
}

function ChangeStatusModal({ course, organizationId, onClose, onSuccess }: ChangeStatusModalProps) {
  const toast = useToast();
  const [selected, setSelected] = useState<CourseStatus>(course.status as CourseStatus);
  const [saving, setSaving] = useState(false);

  const isDirty = selected !== course.status;

  async function handleConfirm() {
    if (!isDirty) return;
    setSaving(true);
    try {
      const apiBase = '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${course.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: selected }),
        },
      );

      let code: unknown = null;
      try { code = (await res.clone().json())?.error; } catch { /* ignore */ }

      if (!res.ok) {
        toast.error(getCourseStatusErrorMessage(code));
        return;
      }

      toast.success('Course status updated successfully.');
      onSuccess(course.id, selected);
      onClose();
    } catch {
      toast.error(getCourseStatusErrorMessage(null));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Change Course Status</h2>
            <p className="mt-0.5 text-sm text-neutral-500 line-clamp-1">{course.title}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
          <span>Current:</span>
          <Badge variant={statusBadgeVariant(course.status)} size="sm">{course.status}</Badge>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-neutral-700">Select new status</legend>
          {STATUS_OPTIONS.map((opt) => {
            const isCurrent = opt.value === course.status;
            const isSelected = opt.value === selected;
            return (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                } ${isCurrent ? 'opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  name="status"
                  value={opt.value}
                  checked={isSelected}
                  onChange={() => setSelected(opt.value)}
                  className="mt-0.5 h-4 w-4 accent-primary-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-900">{opt.label}</span>
                    {isCurrent && (
                      <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-500">
                        current
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">{opt.description}</p>
                </div>
              </label>
            );
          })}
        </fieldset>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isDirty || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Spinner size="sm" />}
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyCoursesPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const orgIdParam = searchParams.get('organization');
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseListItem[] | null>(null);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [statusModalCourseId, setStatusModalCourseId] = useState<string | null>(null);
  const [courseDrawer, setCourseDrawer] = useState<CourseDrawerData | null>(null);
  const [courseDrawerLoading, setCourseDrawerLoading] = useState(false);

  async function openCourseView(course: CourseListItem) {
    if (!organizationId) return;
    setCourseDrawerLoading(true);
    setCourseDrawer({ course: course as CourseContent, modules: [] });
    try {
      const prefix = `/api/v1/organizations/${organizationId}/courses/${course.id}`;
      const courseResponse = await fetch(prefix, { credentials: 'include' });
      const modulesResponse = await fetch(`${prefix}/modules`, { credentials: 'include' });
      if (!courseResponse.ok || !modulesResponse.ok) throw new Error('Unable to load course content');
      const courseBody: { data?: CourseContent } = await courseResponse.json();
      const modulesBody: { data?: Array<{ id: string; title: string; description: string | null; order: number }> } = await modulesResponse.json();
      const modules = await Promise.all((modulesBody.data ?? []).map(async (module) => {
        const [lessonsResponse, quizzesResponse] = await Promise.all([
          fetch(`${prefix}/modules/${module.id}/lessons`, { credentials: 'include' }),
          fetch(`${prefix}/modules/${module.id}/quizzes`, { credentials: 'include' }),
        ]);
        if (!lessonsResponse.ok || !quizzesResponse.ok) throw new Error('Unable to load module content');
        const lessonsBody: { data?: CourseLesson[] } = await lessonsResponse.json();
        const quizzesBody: { data?: Array<Omit<CourseQuiz, 'questions'> & { questions?: CourseQuestion[] }> } = await quizzesResponse.json();
        const quizzes = await Promise.all((quizzesBody.data ?? []).map(async (quiz) => {
          const questionsResponse = await fetch(`${prefix}/modules/${module.id}/quizzes/${quiz.id}/questions`, { credentials: 'include' });
          if (!questionsResponse.ok) throw new Error('Unable to load quiz questions');
          const questionsBody: { data?: Array<Omit<CourseQuestion, 'options'> & { options?: CourseOption[] }> } = await questionsResponse.json();
          const questions = await Promise.all((questionsBody.data ?? []).map(async (question) => {
            if (question.options) return question as CourseQuestion;
            const detailResponse = await fetch(`${prefix}/modules/${module.id}/quizzes/${quiz.id}/questions/${question.id}`, { credentials: 'include' });
            if (!detailResponse.ok) throw new Error('Unable to load question options');
            const detailBody: { data?: CourseQuestion } = await detailResponse.json();
            return detailBody.data ?? { ...question, options: [] };
          }));
          return { ...quiz, questions };
        }));
        return { ...module, lessons: lessonsBody.data ?? [], quizzes };
      }));
      setCourseDrawer({ course: courseBody.data ?? course as CourseContent, modules: modules.sort((a, b) => a.order - b.order) });
    } catch {
      setCourseDrawer(null);
      toast.error('Unable to load complete course details.');
    } finally {
      setCourseDrawerLoading(false);
    }
  }

  // Extract organizationId from URL param or user context, perform role check
  useEffect(() => {
    if (userLoading) return;
    
    if (!user) {
      window.location.href = '/login';
      return;
    }
    
    const role = user.role;
    if (role !== 'ORG_ADMIN' && role !== 'INSTRUCTOR' && role !== 'PLATFORM_ADMIN') {
      window.location.href = '/login';
      return;
    }
    
    const orgId = orgIdParam ?? user.organizationId ?? null;
    if (!orgId) {
      window.location.href = '/login';
      return;
    }
    
    const timer = window.setTimeout(() => setOrganizationId(orgId), 0);
    return () => window.clearTimeout(timer);
  }, [user, userLoading, orgIdParam]);

  // Load courses once organizationId is set
  useEffect(() => {
    if (!organizationId) return;
    let active = true;

    async function load() {
      setCoursesLoading(true);
      try {
        const apiBase = '';
        const res = await fetch(
          `${apiBase}/api/v1/organizations/${organizationId}/courses?scope=organization`,
          { credentials: 'include' },
        );
        if (!active) return;
        if (!res.ok) {
          let code: unknown = null;
          try { code = (await res.json())?.error; } catch { /* ignore */ }
          toast.error(getListCoursesErrorMessage(code));
          return;
        }
        const body: ListCoursesResponse = await res.json();
        if (!active) return;
        setCourses(body.data ?? []);
      } catch {
        if (active) toast.error(getListCoursesErrorMessage(null));
      } finally {
        if (active) setCoursesLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [organizationId, toast]);

  // Optimistic local update — no full reload needed
  function handleStatusSuccess(courseId: string, newStatus: CourseStatus) {
    setCourses((prev) =>
      prev?.map((c) => (c.id === courseId ? { ...c, status: newStatus } : c)) ?? [],
    );
  }

  const activeModal = courses?.find((c) => c.id === statusModalCourseId) ?? null;

  if (userLoading) {
    return (
      <div className="mx-auto flex max-w-3xl items-center gap-3 text-neutral-700">
        <Spinner size="lg" label="Loading..." />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <>
      {activeModal && organizationId && (
        <ChangeStatusModal
          course={activeModal}
          organizationId={organizationId}
          onClose={() => setStatusModalCourseId(null)}
          onSuccess={handleStatusSuccess}
        />
      )}

      <div>
        <div className="mx-auto max-w-5xl">
          <PageHeader
            title="Courses"
            actions={
              <LinkButton
                href={`/dashboard/organization/courses/new${organizationId ? `?organization=${organizationId}` : ''}`}
                size="sm"
              >
                Create Course
              </LinkButton>
            }
          />

          {coursesLoading ? (
            <div className="flex items-center gap-3 text-neutral-700">
              <Spinner size="md" label="Loading courses..." />
              <span>Loading courses...</span>
            </div>
          ) : courses !== null && courses.length === 0 ? (
            <TableCard title="Courses" description="No courses yet">
              <EmptyState
                icon={EmptyStateIcons.NoCourses}
                title="No courses yet"
                description="Create your first course to see it listed here."
                action={{
                  label: 'Create Course',
                  onClick: () => {
                    window.location.href = `/dashboard/organization/courses/new${organizationId ? `?organization=${organizationId}` : ''}`;
                  },
                  variant: 'primary',
                  size: 'sm',
                }}
              />
            </TableCard>
          ) : courses !== null && courses.length > 0 ? (
            <TableCard
              title="Courses"
              description={`${courses.length} course${courses.length === 1 ? '' : 's'}`}
            >
              {/* ── Desktop table ── */}
              <div className="hidden md:block overflow-visible">
                <table className="min-w-full divide-y divide-neutral-200 overflow-visible">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className={tableHeadClass}>Title</th>
                      <th className={tableHeadClass}>Slug</th>
                      <th className={tableHeadClass}>Status</th>
                      <th className={tableHeadClass}>Difficulty</th>
                      <th className={tableHeadClass}>Created</th>
                      <th className={`${tableHeadClass} text-right`}></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {courses.map((course) => (
                      <tr key={course.id} className={tableRowHoverClass}>
                        <td className={`${tableCellClass} font-medium text-primary-600 hover:text-primary-700`}>
                          <a href={`/dashboard/organization/courses/${course.id}${organizationId ? `?organization=${organizationId}` : ''}`}>
                            {course.title}
                          </a>
                        </td>
                        <td className={`${tableCellClass} text-neutral-700`}>{course.slug}</td>
                        <td className={tableCellClass}>
                          <Badge variant={statusBadgeVariant(course.status)} size="sm">
                            {course.status}
                          </Badge>
                        </td>
                        <td className={`${tableCellClass} text-neutral-700`}>{course.difficulty ?? '—'}</td>
                        <td className={`${tableCellClass} text-neutral-700`}>
                          {new Date(course.createdAt).toLocaleDateString()}
                        </td>
                        <td className={`${tableCellClass} text-right`}>
                          <CourseActionsMenu
                            courseId={course.id}
                            manageHref={`/dashboard/organization/courses/${course.id}${organizationId ? `?organization=${organizationId}` : ''}`}
                            onViewClick={() => void openCourseView(course)}
                            onChangeStatusClick={() => setStatusModalCourseId(course.id)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Mobile cards ── */}
              <div className="space-y-3 p-3 md:hidden">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <a
                        href={`/dashboard/organization/courses/${course.id}${organizationId ? `?organization=${organizationId}` : ''}`}
                        className="font-semibold text-primary-600 leading-snug hover:underline"
                      >
                        {course.title}
                      </a>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={statusBadgeVariant(course.status)} size="sm">
                          {course.status}
                        </Badge>
                        <CourseActionsMenu
                          courseId={course.id}
                          manageHref={`/dashboard/organization/courses/${course.id}${organizationId ? `?organization=${organizationId}` : ''}`}
                          onViewClick={() => void openCourseView(course)}
                          onChangeStatusClick={() => setStatusModalCourseId(course.id)}
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">{course.slug}</p>
                    <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                      <span>{course.difficulty ?? '—'}</span>
                      <span>{new Date(course.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </TableCard>
          ) : null}
        </div>
      </div>
      <Drawer
        isOpen={Boolean(courseDrawer)}
        onClose={() => { if (!courseDrawerLoading) setCourseDrawer(null); }}
        title={courseDrawer?.course.title ?? 'Course details'}
      >
        {courseDrawerLoading ? (
          <div className="flex items-center gap-3 text-neutral-700"><Spinner size="md" label="Loading course details..." /><span>Loading complete course details...</span></div>
        ) : courseDrawer ? (
          <div className="space-y-7">
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-neutral-900">Course</h3>
              <p className="whitespace-pre-wrap text-sm text-neutral-700">{courseDrawer.course.description || 'No description available.'}</p>
              <div className="grid grid-cols-2 gap-3 text-sm text-neutral-700">
                <span>Category: {courseDrawer.course.category || '—'}</span>
                <span>Difficulty: {courseDrawer.course.difficulty || '—'}</span>
                <span>Modules: {courseDrawer.modules.length}</span>
                <span>Duration: {courseDrawer.course.estimatedMinutes ? `${courseDrawer.course.estimatedMinutes} minutes` : '—'}</span>
              </div>
            </section>
            <section>
              <h3 className="border-b border-neutral-200 pb-2 text-base font-semibold text-neutral-900">Modules</h3>
              <div className="mt-4 space-y-6">
                {courseDrawer.modules.length === 0 ? <p className="text-sm text-neutral-400">No modules available.</p> : courseDrawer.modules.map((module) => (
                  <div key={module.id} className="rounded-lg border border-neutral-200 p-4">
                    <h4 className="font-semibold text-neutral-900">{module.order}. {module.title}</h4>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-600">{module.description || 'No module description available.'}</p>
                    <h5 className="mt-4 text-sm font-semibold text-neutral-800">Lessons ({module.lessons.length})</h5>
                    <div className="mt-2 space-y-3">
                      {module.lessons.map((lesson) => (
                        <div key={lesson.id} className="rounded-md bg-neutral-50 p-3">
                          <p className="text-sm font-medium text-neutral-900">{lesson.order}. {lesson.title}</p>
                          <p className="mt-1 text-sm text-neutral-700">{lesson.description || 'No description available.'}</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-600">{lesson.content || 'No content available.'}</p>
                        </div>
                      ))}
                    </div>
                    <h5 className="mt-5 text-sm font-semibold text-neutral-800">Quizzes ({module.quizzes.length})</h5>
                    <div className="mt-2 space-y-4">
                      {module.quizzes.map((quiz) => (
                        <div key={quiz.id} className="rounded-md border border-neutral-200 p-3">
                          <p className="font-medium text-neutral-900">{quiz.order}. {quiz.title}</p>
                          <p className="mt-1 text-sm text-neutral-700">{quiz.description || 'No description available.'}</p>
                          <p className="mt-2 text-xs text-neutral-500">Questions: {quiz.questions.length} · Passing: {quiz.passingPercentage ?? '—'}% · Attempts: {quiz.maxAttempts ?? 'Unlimited'}</p>
                          <div className="mt-3 space-y-3">
                            {quiz.questions.map((question) => (
                              <div key={question.id} className="rounded-md bg-neutral-50 p-3">
                                <p className="text-sm font-medium text-neutral-900">{question.order}. {question.questionText}</p>
                                <div className="mt-2 space-y-1">{question.options.map((option) => <p key={option.id} className={`text-sm ${option.isCorrect ? 'font-medium text-green-700' : 'text-neutral-600'}`}>{option.isCorrect ? '✓ ' : ''}{option.text}</p>)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
