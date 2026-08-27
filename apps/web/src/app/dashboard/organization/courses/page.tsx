'use client';

import { useEffect, useState } from 'react';
import { Badge, EmptyState, EmptyStateIcons, Spinner } from '../../../../components/ui';
import { FormError } from '../../../../components/forms/FormError';
import { LinkButton } from '../../../../components/ui/LinkButton';
import { getListCoursesErrorMessage } from '../../../../features/course/listCoursesErrors';

type MeResponse = {
  user?: {
    id?: string;
    name?: string | null;
    email?: string;
    emailVerified?: boolean;
    role?: string | null;
    organizationId?: string | null;
  };
};

type CourseListItem = {
  id: string;
  title: string;
  slug: string;
  status: string;
  difficulty: string | null;
  createdAt: string;
};

type ListCoursesResponse = {
  success?: boolean;
  data?: CourseListItem[];
  error?: string;
};

function statusBadgeVariant(status: string) {
  if (status === 'PUBLISHED') return 'success' as const;
  if (status === 'REVIEW') return 'warning' as const;
  if (status === 'ARCHIVED') return 'error' as const;
  return 'default' as const;
}

export default function MyCoursesPage() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const role = meData.user?.role;
        if (role !== 'ORG_ADMIN' && role !== 'INSTRUCTOR') {
          window.location.href = '/login';
          return;
        }
        const orgId = meData.user?.organizationId ?? null;
        if (!orgId) {
          window.location.href = '/login';
          return;
        }
        setOrganizationId(orgId);
      } catch {
        if (active) window.location.href = '/login';
      } finally {
        if (active) setCheckingAuth(false);
      }
    }

    guard();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        const res = await fetch(
          `${apiBase}/api/v1/organizations/${organizationId}/courses`,
          { credentials: 'include' }
        );
        if (!active) return;
        if (!res.ok) {
          let code: unknown = null;
          try {
            code = (await res.json())?.error;
          } catch {
            code = null;
          }
          setError(getListCoursesErrorMessage(code));
          return;
        }
        const body: ListCoursesResponse = await res.json();
        if (!active) return;
        setCourses(body.data ?? []);
      } catch {
        if (active) setError(getListCoursesErrorMessage(null));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [organizationId]);

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto flex max-w-3xl items-center gap-3 text-neutral-700">
          <Spinner size="lg" label="Loading..." />
          <span>Loading...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium uppercase tracking-wide text-primary-600">My Courses</p>
          <LinkButton href="/dashboard/organization" variant="ghost" size="sm">
            Back to dashboard
          </LinkButton>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Courses</h1>
              <p className="mt-1 text-sm text-neutral-500">
                Courses belonging to your organization.
              </p>
            </div>
            <LinkButton href="/dashboard/organization/courses/new" size="sm">
              Create Course
            </LinkButton>
          </div>

          {error ? (
            <div className="mt-6">
              <FormError message={error} />
            </div>
          ) : null}

          {loading ? (
            <div className="mt-8 flex items-center gap-3 text-neutral-700">
              <Spinner size="md" label="Loading courses..." />
              <span>Loading courses...</span>
            </div>
          ) : courses !== null && courses.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                icon={EmptyStateIcons.NoCourses}
                title="No courses yet"
                description="Create your first course to see it listed here."
                action={{
                  label: 'Create Course',
                  onClick: () => {
                    window.location.href = '/dashboard/organization/courses/new';
                  },
                  variant: 'primary',
                  size: 'sm',
                }}
              />
            </div>
          ) : courses !== null && courses.length > 0 ? (
            <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Slug</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Difficulty</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 bg-white">
                  {courses.map((course) => (
                    <tr key={course.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-4 text-sm font-medium text-primary-600 hover:text-primary-700">
                        <a href={`/dashboard/organization/courses/${course.id}`}>{course.title}</a>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-700">{course.slug}</td>
                      <td className="px-6 py-4">
                        <Badge variant={statusBadgeVariant(course.status)} size="sm">
                          {course.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-700">{course.difficulty ?? '—'}</td>
                      <td className="px-6 py-4 text-sm text-neutral-700">
                        {new Date(course.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
