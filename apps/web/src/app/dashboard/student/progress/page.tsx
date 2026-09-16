'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EmptyState, EmptyStateIcons, ErrorState, Spinner } from '@/components/ui';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { useStudentProgress, type CourseProgress } from '@/features/student/useProgress';

function ProgressBar({ value }: { value: number }) {
  const percentage = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#f5e8dc]">
      <div className="h-full rounded-full bg-[#5a321f] transition-all" style={{ width: `${percentage}%` }} />
    </div>
  );
}

function CourseCard({ course }: { course: CourseProgress }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {course.courseThumbnail ? (
        <img src={course.courseThumbnail} alt="" className="h-24 w-full object-cover" />
      ) : (
        <div className="h-8 bg-gradient-to-r from-primary-100 to-accent-100" aria-hidden="true" />
      )}
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">{course.courseTitle}</h2>
          </div>
          <span className="text-xl font-semibold text-[#5a321f]">{course.coursePercentage}%</span>
        </div>
        <div className="mt-4"><ProgressBar value={course.coursePercentage} /></div>
        <div className="mt-4 flex flex-wrap gap-2">
          {!course.courseComplete && course.lastVisited?.lessonId && course.lastVisited.moduleId ? (
            <Link
              href={`/dashboard/student/courses/${course.courseId}/modules/${course.lastVisited.moduleId}/lessons/${course.lastVisited.lessonId}`}
              className="flex-1 rounded-lg bg-[#f5e8dc] px-4 py-2 text-center text-sm font-medium text-[#5a321f] hover:bg-[#eedbc9]"
            >
              Continue Learning
            </Link>
          ) : (
            <Link
              href={`/dashboard/student/courses/${course.courseId}`}
              className="flex-1 rounded-lg bg-[#f5e8dc] px-4 py-2 text-center text-sm font-medium text-[#5a321f] hover:bg-[#eedbc9]"
            >
              {course.courseComplete ? 'View Course' : 'Start Learning'}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex-1 rounded-lg bg-[#5a321f] px-4 py-2 text-sm font-medium text-white hover:bg-[#472719]"
            aria-expanded={expanded}
          >
            {expanded ? 'Hide modules' : 'View modules'}
          </button>
        </div>

        {expanded && (
          <div className="mt-6 space-y-4 border-t border-neutral-200 pt-5">
            {course.modules.length === 0 ? (
              <p className="text-sm text-neutral-500">This course has no learning items yet.</p>
            ) : course.modules.map((module) => (
              <section key={module.id}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-neutral-900">{module.title}</h3>
                  <span className="text-sm text-neutral-500">
                    {module.completedItemCount ?? 0} / {module.requiredItemCount ?? 0}
                  </span>
                </div>
                <div className="mt-2"><ProgressBar value={module.percentage} /></div>
                {module.items && module.items.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {module.items.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 text-sm text-neutral-700">
                        <span className={item.completed ? 'text-success-600' : item.failed ? 'text-error-600' : 'text-neutral-400'} aria-hidden="true">
                          {item.completed ? '✓' : item.failed ? '!' : '○'}
                        </span>
                        <span>{item.title}</span>
                        <span className={`text-xs ${item.failed ? 'font-medium text-error-600' : 'text-neutral-400'}`}>
                          {item.failed ? 'Quiz failed' : item.type === 'QUIZ' ? 'Quiz' : 'Lesson'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export default function StudentProgressPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const { data: courses = [], isLoading, isError, error, refetch } = useStudentProgress(organizationId ?? '');

  useEffect(() => {
    if (userLoading) return;
    if (!user || user.role !== 'STUDENT' || !user.organizationId) {
      window.location.href = '/login';
      return;
    }
    setOrganizationId(user.organizationId);
  }, [user, userLoading]);

  if (userLoading || isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center gap-3 text-neutral-700"><Spinner size="lg" label="Loading your progress..." /><span>Loading your progress...</span></div>;
  }

  return (
    <div className="mx-auto max-w-6xl">
      {isError ? (
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <ErrorState title="Unable to load your progress" message={error instanceof Error ? error.message : 'Please try again.'} action={{ label: 'Try Again', onClick: () => { void refetch(); } }} />
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <EmptyState icon={EmptyStateIcons.NoCourses} title="No courses yet" description="You haven't enrolled in any courses yet." action={{ label: 'Explore Courses', onClick: () => { window.location.href = '/dashboard/student/search'; } }} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">{courses.map((course) => <CourseCard key={course.courseId} course={course} />)}</div>
      )}
    </div>
  );
}
