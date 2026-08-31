'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  EmptyState,
  EmptyStateIcons,
  ErrorState,
  LinkButton,
  Spinner,
} from '@/components/ui';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { getJson } from '@/lib/api';
import {
  PageHeader,
  StatCard,
  StatCardSkeleton,
  TableCard,
  Calendar,
  tableHeadClass,
  tableCellClass,
  tableRowHoverClass,
} from '@/components/dashboard';

type CourseItem = { id: string; title: string; status: string; difficulty: string | null; createdAt: string };

const statusBadgeVariant = (status: string) => {
  if (status === 'PUBLISHED') return 'success' as const;
  if (status === 'ARCHIVED') return 'default' as const;
  return 'warning' as const;
};

const CourseIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.9-4.5-.4" />
  </svg>
);

const PublishIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const DraftIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

export default function InstructorDashboardPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const {
    data: courses,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['instructor', 'courses'],
    queryFn: async () => {
      const body = await getJson<{ data?: CourseItem[] }>(
        `/api/v1/organizations/${user?.organizationId ?? ''}/courses?page=1&limit=100`,
      );
      return body.data ?? [];
    },
    enabled: user?.role === 'INSTRUCTOR' && Boolean(user?.organizationId),
  });

  useEffect(() => {
    if (userLoading) return;
    if (!user || user.role !== 'INSTRUCTOR') {
      window.location.href =
        user?.role === 'ORG_ADMIN'
          ? '/dashboard/organization'
          : user?.role === 'PLATFORM_ADMIN'
            ? '/dashboard'
            : user?.role === 'STUDENT'
              ? '/dashboard/student'
              : '/';
    }
  }, [user, userLoading]);

  const publishedCount = (courses ?? []).filter((c) => c.status === 'PUBLISHED').length;
  const draftCount = (courses?.length ?? 0) - publishedCount;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
          title={`Welcome, ${user?.name ?? 'Instructor'}`}
          actions={
            <LinkButton href="/dashboard/organization/courses/new">Create Course</LinkButton>
          }
        />

        {isLoading ? (
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
            <div className="flex items-center gap-3 text-neutral-700">
              <Spinner size="lg" label="Loading your courses..." />
              <span>Loading your courses...</span>
            </div>
          </>
        ) : isError ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState
              title="Unable to load your courses"
              message="Your course list could not be loaded. Please try again."
              action={{ label: 'Retry', onClick: () => void refetch() }}
            />
          </div>
        ) : courses && courses.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <EmptyState
              icon={EmptyStateIcons.NoCourses}
              title="No courses yet"
              description="Create your first course to start teaching. You can build modules, lessons, and quizzes for each course."
              action={{ label: 'Create your first course', onClick: () => { window.location.href = '/dashboard/organization/courses/new'; } }}
            />
          </div>
        ) : (
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                label="Total courses"
                value={courses?.length ?? 0}
                hint="Everything you're teaching"
                icon={CourseIcon}
                tone="primary"
              />
              <StatCard
                label="Published"
                value={publishedCount}
                hint="Live and visible to students"
                icon={PublishIcon}
                tone="success"
              />
              <StatCard
                label="In progress"
                value={draftCount}
                hint="Draft or in review"
                icon={DraftIcon}
                tone="warning"
              />
            </div>

            {/* Calendar */}
            <div className="mb-8">
              <Calendar />
            </div>

            <TableCard
              title="My Courses"
              description={`${courses?.length ?? 0} course${(courses?.length ?? 0) !== 1 ? 's' : ''}`}
              action={
                <LinkButton href="/dashboard/organization/courses/new" size="sm">
                  New Course
                </LinkButton>
              }
            >
              {/* Desktop table */}
              <div className="hidden md:block">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className={tableHeadClass}>Title</th>
                      <th className={tableHeadClass}>Difficulty</th>
                      <th className={tableHeadClass}>Status</th>
                      <th className={tableHeadClass}>Created</th>
                      <th className={`${tableHeadClass} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {courses?.map((course) => (
                      <tr key={course.id} className={tableRowHoverClass}>
                        <td className={`${tableCellClass} font-medium text-neutral-900`}>{course.title}</td>
                        <td className={`${tableCellClass} text-neutral-600`}>{course.difficulty ?? '—'}</td>
                        <td className={tableCellClass}>
                          <Badge variant={statusBadgeVariant(course.status)} size="sm">{course.status}</Badge>
                        </td>
                        <td className={`${tableCellClass} text-neutral-600`}>
                          {new Date(course.createdAt).toLocaleDateString()}
                        </td>
                        <td className={`${tableCellClass} text-right`}>
                          <LinkButton href={`/dashboard/organization/courses/${course.id}`} size="sm" variant="outline">
                            Manage
                          </LinkButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="space-y-3 p-3 md:hidden">
                {courses?.map((course) => (
                  <div key={course.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-neutral-900 leading-snug">{course.title}</p>
                      <Badge variant={statusBadgeVariant(course.status)} size="sm">{course.status}</Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                      <span>{course.difficulty ?? '—'}</span>
                      <span>{new Date(course.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-3">
                      <LinkButton href={`/dashboard/organization/courses/${course.id}`} size="sm" variant="outline">
                        Manage
                      </LinkButton>
                    </div>
                  </div>
                ))}
              </div>
            </TableCard>
          </>
        )}
      </div>
  );
}
