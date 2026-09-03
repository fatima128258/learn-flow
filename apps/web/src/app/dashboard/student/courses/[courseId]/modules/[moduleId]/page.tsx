'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Badge,
  Button,
  EmptyState,
  EmptyStateIcons,
  ErrorState,
  Spinner,
} from '@/components/ui';
import { PageHeader } from '@/components/dashboard';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { useProgress, useRecordProgress, useGenerateCertificate } from '@/features/student/useProgress';

type LessonItem = {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  duration: number | null;
  order: number;
  isPreview: boolean;
};

type ModuleLessonsResponse = {
  moduleId: string;
  moduleTitle: string;
  courseId: string;
  courseName: string;
  lessons: LessonItem[];
};

function lessonTypeIcon(type: string | null) {
  switch (type?.toLowerCase()) {
    case 'video':
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'article':
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'pdf':
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    default:
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
  }
}

type LessonRowProps = {
  lesson: LessonItem;
  index: number;
  courseId: string;
  moduleId: string;
  organizationId: string;
  isCompleted: boolean;
  onMarkingChange: (lessonId: string | null) => void;
  markingLessonId: string | null;
  onError: (error: string | null) => void;
  onMarkedSuccess?: (lessonId: string) => void;
};

function LessonRow({
  lesson,
  index,
  courseId,
  moduleId,
  organizationId,
  isCompleted,
  onMarkingChange,
  markingLessonId,
  onError,
  onMarkedSuccess,
}: LessonRowProps) {
  const recordProgress = useRecordProgress(organizationId, courseId, moduleId, lesson.id);
  const isMarking = markingLessonId === lesson.id;

  const handleMarkViewed = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent double-click while already marking
    if (isMarking || recordProgress.isPending) return;
    
    onMarkingChange(lesson.id);
    onError(null);
    
    try {
      await recordProgress.mutateAsync(true);
      // Mark as completed locally and call success callback
      onMarkedSuccess?.(lesson.id);
      // Success - cache is automatically invalidated by the mutation
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to mark lesson as viewed. Please try again.';
      onError(errorMessage);
    } finally {
      onMarkingChange(null);
    }
  };

  return (
    <Link
      href={`/dashboard/student/courses/${courseId}/modules/${moduleId}/lessons/${lesson.id}`}
    >
      <div className="group flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:border-primary-200 hover:shadow-md cursor-pointer">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-50 text-neutral-600 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
          {isCompleted ? (
            <svg className="h-5 w-5 text-success-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            lessonTypeIcon(lesson.type)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-neutral-400">{index + 1}.</span>
            <h3 className="font-medium text-neutral-900 group-hover:text-primary-600 transition-colors truncate">
              {lesson.title}
            </h3>
            {lesson.isPreview && (
              <Badge variant="info" size="sm">Preview</Badge>
            )}
            {isCompleted && (
              <Badge variant="success" size="sm">✓ Completed</Badge>
            )}
          </div>
          {lesson.description && (
            <p className="mt-0.5 text-sm text-neutral-500 line-clamp-1">{lesson.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-neutral-500 flex-shrink-0">
          {lesson.type && (
            <Badge variant="default" size="sm">{lesson.type}</Badge>
          )}
          {lesson.duration != null && (
            <span className="whitespace-nowrap">{lesson.duration}m</span>
          )}
          {!isCompleted && (
            <Button
              size="sm"
              variant="primary"
              disabled={isMarking || recordProgress.isPending}
              onClick={handleMarkViewed}
              title="Mark this lesson as viewed"
            >
              {isMarking || recordProgress.isPending ? 'Saving...' : 'Mark Viewed'}
            </Button>
          )}
          {isCompleted && (
            <svg 
              className="h-5 w-5 text-success-500 flex-shrink-0" 
              fill="currentColor" 
              viewBox="0 0 20 20"
              aria-label="Lesson completed"
            >
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function StudentModuleLessonsPage() {
  const params = useParams();
  const courseId = typeof params.courseId === 'string' ? params.courseId : null;
  const moduleId = typeof params.moduleId === 'string' ? params.moduleId : null;
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [data, setData] = useState<ModuleLessonsResponse | null>(null);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [markingLessonId, setMarkingLessonId] = useState<string | null>(null);
  const [markingError, setMarkingError] = useState<string | null>(null);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());

  // Use progress hook to get lesson completion status
  const { 
    data: progress, 
    isLoading: progressLoading, 
    error: progressError 
  } = useProgress(organizationId ?? '', courseId ?? '');

  // Generate certificate mutation
  const generateCertificate = useGenerateCertificate(organizationId ?? '', courseId ?? '');

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
    if (courseId && moduleId) loadLessons(orgId, courseId, moduleId);
  }, [user, userLoading, courseId, moduleId]);

  async function loadLessons(orgId: string, cid: string, mid: string) {
    try {
      const apiBase = '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${orgId}/student/courses/${cid}/modules/${mid}/lessons`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        let code: unknown = null;
        try {
          code = (await res.json())?.error;
        } catch {
          code = null;
        }
        if (code === 'STUDENT_NOT_ENROLLED') {
          setLessonError('You are not enrolled in this course.');
        } else if (code === 'MODULE_NOT_FOUND') {
          setLessonError('Module not found.');
        } else {
          setLessonError('Could not load lessons. Please try again.');
        }
        return;
      }
      const body = await res.json();
      setData(body.data ?? null);
    } catch {
      setLessonError('Could not reach the server. Please try again.');
    }
  }

  // Helper to find module progress data
  const currentModule = progress?.modules.find(m => m.id === moduleId);

  // Check if course is 100% complete
  const isCourseComplete = progress?.coursePercentage === 100;

  // Get lesson completion status from progress data
  // We need to fetch the full progress to know which lessons are completed
  const getLessonCompletionStatus = (lessonId: string): boolean => {
    if (!progress) return false;
    
    // Get all completed lesson IDs from the progress data
    // This is inferred from the module progress (completedLessons count)
    // For a more accurate check, we'd need the backend to return individual lesson IDs
    // For now, we'll check if this lesson appears to be completed by comparing counts
    
    // The backend API doesn't return individual lesson completion status,
    // so we rely on the UI state being updated after mutation success
    // The mutation invalidates the progress query, which will refetch
    return false; // Will be updated when progress query refetches
  };

  const isLoading = userLoading || progressLoading;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader
          subtitle="Student"
          title="Module Lessons"
        />
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-neutral-200 bg-white p-12 shadow-sm text-neutral-700">
          <Spinner size="lg" label="Loading lessons..." />
          <span className="text-lg font-medium">Loading lessons...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        subtitle="Student"
        title="Module Lessons"
          breadcrumbs={
            <div className="flex items-center gap-2 text-sm">
              <Link href="/dashboard/student" className="text-primary-600 hover:text-primary-700">My Courses</Link>
              <span className="text-neutral-400">/</span>
              {data && (
                <>
                  <Link href={`/dashboard/student/courses/${courseId}`} className="text-primary-600 hover:text-primary-700">
                    {data.courseName}
                  </Link>
                  <span className="text-neutral-400">/</span>
                </>
              )}
              <span className="text-neutral-600">{data?.moduleTitle ?? 'Module'}</span>
            </div>
          }
        />

        {lessonError ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState
              title="Unable to load lessons"
              message={lessonError}
              action={organizationId && courseId && moduleId ? { label: 'Retry', onClick: () => loadLessons(organizationId, courseId!, moduleId!) } : undefined}
            />
          </div>
        ) : data ? (
          <>
            <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h1 className="text-2xl font-bold text-neutral-900">{data.moduleTitle}</h1>
              {currentModule && (
                <p className="mt-1 text-sm text-neutral-500">
                  {currentModule.completedLessons} of {currentModule.lessonCount} lessons completed ({currentModule.percentage}%)
                </p>
              )}
              <p className="mt-1 text-sm text-neutral-500">
                {data.lessons.length} lesson{data.lessons.length !== 1 ? 's' : ''} in this module
              </p>
            </div>

            {data.lessons.length === 0 ? (
              <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <EmptyState
                  icon={EmptyStateIcons.NoData}
                  title="No lessons yet"
                  description="The instructor hasn't added any lessons to this module yet."
                />
              </div>
            ) : (
              <div className="space-y-2">
                {data.lessons.map((lesson, index) => (
                  <LessonRow
                    key={lesson.id}
                    lesson={lesson}
                    index={index}
                    courseId={courseId!}
                    moduleId={moduleId!}
                    organizationId={organizationId!}
                    isCompleted={completedLessonIds.has(lesson.id)}
                    onMarkingChange={setMarkingLessonId}
                    markingLessonId={markingLessonId}
                    onError={setMarkingError}
                    onMarkedSuccess={(lessonId) => {
                      setCompletedLessonIds(prev => new Set(prev).add(lessonId));
                    }}
                  />
                ))}
              </div>
            )}

            {markingError && (
              <div className="mt-4 rounded-lg border border-error-200 bg-error-50 p-3">
                <p className="text-sm text-error-700">{markingError}</p>
                <button
                  onClick={() => setMarkingError(null)}
                  className="mt-2 text-sm text-error-600 hover:text-error-700"
                >
                  Dismiss
                </button>
              </div>
            )}

            {isCourseComplete && (
              <div className="mt-8 rounded-2xl border border-success-200 bg-success-50 p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-success-900">Course Completed!</h2>
                    <p className="mt-1 text-sm text-success-700">
                      You have successfully completed all lessons. Generate your certificate to recognize your achievement.
                    </p>
                  </div>
                  <Button
                    size="md"
                    variant="primary"
                    disabled={generateCertificate.isPending}
                    onClick={async () => {
                      try {
                        await generateCertificate.mutateAsync();
                        // Success - redirect to certificate
                        window.location.href = '/dashboard/student/certificates';
                      } catch (error) {
                        // If certificate already exists, redirect to certificates page
                        if (error instanceof Error && error.message === 'CERTIFICATE_EXISTS') {
                          window.location.href = '/dashboard/student/certificates';
                          return;
                        }
                        const errorMessage = error instanceof Error 
                          ? error.message 
                          : 'Failed to generate certificate. Please try again.';
                        setMarkingError(errorMessage);
                      }
                    }}
                    title="Generate your certificate for completing this course"
                  >
                    {generateCertificate.isPending ? 'Generating...' : 'Generate Certificate'}
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
  );
}
