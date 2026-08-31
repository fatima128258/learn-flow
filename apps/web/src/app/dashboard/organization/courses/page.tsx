'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge, EmptyState, EmptyStateIcons, Spinner } from '../../../../components/ui';
import { LinkButton } from '../../../../components/ui/LinkButton';
import { getListCoursesErrorMessage } from '../../../../features/course/listCoursesErrors';
import { useToast } from '../../../../components/ui/ToastProvider';
import {
  PageHeader,
  TableCard,
  tableHeadClass,
  tableCellClass,
  tableRowHoverClass,
} from '../../../../components/dashboard';

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
  const toast = useToast();
  const searchParams = useSearchParams();
  const orgIdParam = searchParams.get('organization');

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseListItem[] | null>(null);
  const [loading, setLoading] = useState(true);

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
        if (role !== 'ORG_ADMIN' && role !== 'INSTRUCTOR' && role !== 'PLATFORM_ADMIN') {
          window.location.href = '/login';
          return;
        }
        const orgId = orgIdParam ?? meData.user?.organizationId ?? null;
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
  }, [orgIdParam]);

  useEffect(() => {
    if (!organizationId) return;
    let active = true;

    async function load() {
      setLoading(true);
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
          toast.error(getListCoursesErrorMessage(code));
          return;
        }
        const body: ListCoursesResponse = await res.json();
        if (!active) return;
        setCourses(body.data ?? []);
      } catch {
        if (active) toast.error(getListCoursesErrorMessage(null));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [organizationId, toast]);

  if (checkingAuth) {
    return (
      <div>
        <div className="mx-auto flex max-w-3xl items-center gap-3 text-neutral-700">
          <Spinner size="lg" label="Loading..." />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-5xl">
        <PageHeader
          subtitle="My Courses"
          title="Courses"
          description="Courses belonging to your organization."
          breadcrumbs={
            <LinkButton href="/dashboard/organization" variant="ghost" size="sm">
              Back to dashboard
            </LinkButton>
          }
          actions={
            <LinkButton href="/dashboard/organization/courses/new" size="sm">
              Create Course
            </LinkButton>
          }
        />

        {loading ? (
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
                  window.location.href = '/dashboard/organization/courses/new';
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
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className={tableHeadClass}>Title</th>
                    <th className={tableHeadClass}>Slug</th>
                    <th className={tableHeadClass}>Status</th>
                    <th className={tableHeadClass}>Difficulty</th>
                    <th className={tableHeadClass}>Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {courses.map((course) => (
                    <tr key={course.id} className={tableRowHoverClass}>
                      <td className={`${tableCellClass} font-medium text-primary-600 hover:text-primary-700`}>
                        <a href={`/dashboard/organization/courses/${course.id}`}>{course.title}</a>
                      </td>
                      <td className={`${tableCellClass} text-neutral-700`}>{course.slug}</td>
                      <td className={tableCellClass}>
                        <Badge variant={statusBadgeVariant(course.status)} size="sm">{course.status}</Badge>
                      </td>
                      <td className={`${tableCellClass} text-neutral-700`}>{course.difficulty ?? '—'}</td>
                      <td className={`${tableCellClass} text-neutral-700`}>
                        {new Date(course.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="space-y-3 p-3 md:hidden">
              {courses.map((course) => (
                <a key={course.id} href={`/dashboard/organization/courses/${course.id}`} className="block rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm hover:border-primary-200 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-primary-600 leading-snug">{course.title}</p>
                    <Badge variant={statusBadgeVariant(course.status)} size="sm">{course.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-neutral-400">{course.slug}</p>
                  <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                    <span>{course.difficulty ?? '—'}</span>
                    <span>{new Date(course.createdAt).toLocaleDateString()}</span>
                  </div>
                </a>
              ))}
            </div>
          </TableCard>
        ) : null}
      </div>
    </div>
  );
}
