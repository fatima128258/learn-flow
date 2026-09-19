'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EmptyState, EmptyStateIcons, ErrorState, Input, Spinner } from '@/components/ui';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { useStudentProgress, type CourseProgress } from '@/features/student/useProgress';
import { Drawer } from '@/components/ui';

function ProgressBar({ value }: { value: number }) {
  const percentage = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#f5e8dc]">
      <div className="h-full rounded-full bg-[#d8b596] transition-all" style={{ width: `${percentage}%` }} />
    </div>
  );
}

function CourseCard({ course }: { course: CourseProgress }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const completedLessons = course.completedLessons;
  const pendingLessons = Math.max(0, course.totalLessons - completedLessons);
  const completedModules = course.modules.filter((module) => module.complete).length;
  const pendingModules = Math.max(0, course.modules.length - completedModules);
  const totalQuizAttempts = course.quizzes.reduce((total, quiz) => total + quiz.attempts, 0);

  return (
    <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {course.courseThumbnail ? (
        <img src={course.courseThumbnail} alt="" className="h-24 w-full object-cover" />
      ) : (
        <div className="h-8 bg-gradient-to-r from-primary-100 to-accent-100" aria-hidden="true" />
      )}
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-neutral-900" title={course.courseTitle}>
              {course.courseTitle}
            </h2>
          </div>
          <span className="text-xl font-semibold text-[#5a321f]">{course.coursePercentage}%</span>
        </div>
        <div className="mt-4"><ProgressBar value={course.coursePercentage} /></div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/dashboard/student/chat?courseId=${encodeURIComponent(course.courseId)}`}
            className="flex-1 rounded-lg bg-[#f5e8dc] px-4 py-2 text-center text-sm font-medium text-[#5a321f] hover:bg-[#eedbc9]"
          >
            Chat
          </Link>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="flex-1 rounded-lg bg-[#5a321f] px-4 py-2 text-sm font-medium text-white hover:bg-[#472719]"
          >
            View modules
          </button>
        </div>

        <Drawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          title={`${course.courseTitle} progress`}
        >
          <div className="space-y-6">
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Modules complete', `${completedModules}/${course.modules.length}`],
                ['Lessons complete', `${completedLessons}/${course.totalLessons}`],
                ['Lessons pending', String(pendingLessons)],
                ['Quiz attempts', String(totalQuizAttempts)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-[#ead8c6] bg-[#fffaf5] p-3">
                  <p className="text-xs text-neutral-500">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-[#5a321f]">{value}</p>
                </div>
              ))}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-neutral-900">Module progress</h3>
                <span className="text-sm text-neutral-500">{pendingModules} pending</span>
              </div>
              <div className="space-y-4">
                {course.modules.length === 0 ? (
                  <p className="text-sm text-neutral-500">This course has no learning modules yet.</p>
                ) : course.modules.map((module) => (
                  <div key={module.id} className="rounded-xl border border-neutral-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-neutral-900">{module.title}</h4>
                        <p className="mt-1 text-sm text-neutral-500">
                          {module.completedLessons} of {module.lessonCount} lessons complete
                        </p>
                      </div>
                      <span className={module.complete ? 'text-sm font-semibold text-success-600' : 'text-sm font-semibold text-neutral-500'}>
                        {module.complete ? 'Complete' : `${module.percentage}%`}
                      </span>
                    </div>
                    <div className="mt-3"><ProgressBar value={module.percentage} /></div>
                    {module.items && module.items.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {module.items.map((item) => (
                          <li key={item.id} className="flex items-center gap-2 text-sm text-neutral-700">
                            <span className={item.completed ? 'text-success-600' : item.failed ? 'text-error-600' : 'text-neutral-400'} aria-hidden="true">
                              {item.completed ? '✓' : item.failed ? '!' : '○'}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{item.title}</span>
                            <span className={`shrink-0 text-xs ${item.failed ? 'font-medium text-error-600' : 'text-neutral-400'}`}>
                              {item.failed ? 'Failed' : item.completed ? 'Complete' : item.type === 'QUIZ' ? 'Quiz pending' : 'Lesson pending'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-3 font-semibold text-neutral-900">Quiz attempts and results</h3>
              {course.quizzes.length === 0 ? (
                <p className="text-sm text-neutral-500">No quizzes in this course.</p>
              ) : (
                <div className="space-y-3">
                  {course.quizzes.map((quiz) => (
                    <div key={quiz.quizId} className="rounded-xl border border-neutral-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-medium text-neutral-900">{quiz.title}</h4>
                        <span className="text-sm text-neutral-500">{quiz.attempts} attempt{quiz.attempts === 1 ? '' : 's'}</span>
                      </div>
                      {quiz.results.length === 0 ? (
                        <p className="mt-2 text-sm text-neutral-500">No attempts yet.</p>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {quiz.results.map((result) => (
                            <div key={`${quiz.quizId}-${result.attemptNumber}`} className="flex items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2 text-sm">
                              <span className="text-neutral-600">Attempt {result.attemptNumber}</span>
                              <span className="text-right">
                                <span className="font-medium text-neutral-900">
                                  {result.percentage == null ? '—' : `${Math.round(result.percentage)}%`}
                                </span>
                                <span className={result.passed ? 'ml-2 text-success-600' : 'ml-2 text-error-600'}>
                                  {result.passed ? 'Passed' : 'Not passed'}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </Drawer>
      </div>
    </article>
  );
}

export default function StudentProgressPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: courses = [], isLoading, isError, error, refetch } = useStudentProgress(organizationId ?? '');
  const filteredCourses = courses.filter((course) => (
    !searchQuery.trim() || course.courseTitle.toLowerCase().includes(searchQuery.trim().toLowerCase())
  ));

  useEffect(() => {
    if (userLoading) return;
    if (!user || user.role !== 'STUDENT' || !user.organizationId) {
      window.location.href = '/login';
      return;
    }
    setOrganizationId(user.organizationId);
  }, [user, userLoading]);

  if (userLoading || isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center" role="status" aria-label="Loading progress">
        <Spinner size="md" label="Loading..." />
      </div>
    );
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
        <>
          <Input
            variant="line"
            placeholder="Search your progress"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="mb-6 max-w-xl"
            aria-label="Search your progress"
          />
          {filteredCourses.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <EmptyState
                icon={EmptyStateIcons.NoData}
                title="No matching courses"
                description="Try a different course name."
              />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {filteredCourses.map((course) => <CourseCard key={course.courseId} course={course} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
