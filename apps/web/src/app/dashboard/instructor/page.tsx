'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  EmptyState,
  EmptyStateIcons,
  ErrorState,
  LinkButton,
  Spinner,
} from '@/components/ui';
import { DashboardLayout, NavIcons, type NavItem } from '@/components/layout/DashboardLayout';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { getJson } from '@/lib/api';

const instructorNav: NavItem[] = [
  { href: '/dashboard/instructor', label: 'Dashboard', icon: NavIcons.dashboard },
  { href: '/dashboard/organization/courses', label: 'My Courses', icon: NavIcons.courses },
];

type CourseItem = { id: string; title: string; status: string; difficulty: string | null; createdAt: string };

const statusBadgeVariant = (status: string) => {
  if (status === 'PUBLISHED') return 'success' as const;
  if (status === 'ARCHIVED') return 'default' as const;
  return 'warning' as const;
};

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userLoading]);

  const publishedCount = (courses ?? []).filter((c) => c.status === 'PUBLISHED').length;

  return (
    <DashboardLayout navLabel="Instructor" items={instructorNav}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Instructor</p>
              <h1 className="mt-2 text-3xl font-bold text-neutral-900">Welcome, {user?.name ?? 'Instructor'}</h1>
              <p className="mt-2 text-sm text-neutral-600">
                Create and publish courses, then manage modules, lessons, and quizzes for your students.
              </p>
            </div>
            <LinkButton href="/dashboard/organization/courses/new">Create Course</LinkButton>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-3 text-neutral-700">
            <Spinner size="lg" label="Loading your courses..." />
            <span>Loading your courses...</span>
          </div>
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
            <div className="mb-8 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-neutral-500">Total courses</p>
                <p className="mt-3 text-3xl font-bold text-neutral-900">{courses?.length ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-neutral-500">Published</p>
                <p className="mt-3 text-3xl font-bold text-emerald-600">{publishedCount}</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-neutral-500">In progress</p>
                <p className="mt-3 text-3xl font-bold text-warning-600">
                  {(courses?.length ?? 0) - publishedCount}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-neutral-900">My Courses</h2>
                <p className="text-sm text-neutral-600">{courses?.length} course{courses?.length !== 1 ? 's' : ''}</p>
              </div>
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Difficulty</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Created</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {courses?.map((course) => (
                    <tr key={course.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-4 text-sm font-medium text-neutral-900">{course.title}</td>
                      <td className="px-6 py-4 text-sm text-neutral-600">{course.difficulty ?? '—'}</td>
                      <td className="px-6 py-4">
                        <Badge variant={statusBadgeVariant(course.status)} size="sm">{course.status}</Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-700">
                        {new Date(course.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <LinkButton href={`/dashboard/organization/courses/${course.id}`} size="sm" variant="outline">
                          Manage
                        </LinkButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}