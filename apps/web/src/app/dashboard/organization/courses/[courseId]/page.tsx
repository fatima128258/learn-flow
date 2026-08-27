'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Alert, Badge, Spinner } from '../../../../../components/ui';
import { FormError } from '../../../../../components/forms/FormError';
import { LinkButton } from '../../../../../components/ui/LinkButton';
import { getCreateCourseErrorMessage } from '../../../../../features/course/createCourseErrors';

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

type CourseDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  category: string | null;
  price: number | string | null;
  discountPrice: number | string | null;
  estimatedMinutes: number | null;
  difficulty: string | null;
  learningObjectives: string[];
  status: string;
  createdAt: string;
};

type GetCourseResponse = {
  success?: boolean;
  data?: CourseDetail;
  error?: string;
};

function statusBadgeVariant(status: string) {
  if (status === 'PUBLISHED') return 'success' as const;
  if (status === 'REVIEW') return 'warning' as const;
  if (status === 'ARCHIVED') return 'error' as const;
  return 'default' as const;
}

function formatMoney(value: number | string | null): string {
  if (value === null || value === undefined) return '—';
  return String(value);
}

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = typeof params.courseId === 'string' ? params.courseId : null;

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [course, setCourse] = useState<CourseDetail | null>(null);
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
    if (!organizationId || !courseId) return;
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        const res = await fetch(
          `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}`,
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
          setError(getCreateCourseErrorMessage(code));
          return;
        }
        const body: GetCourseResponse = await res.json();
        if (!active) return;
        if (!body.data) {
          setError(getCreateCourseErrorMessage('COURSE_NOT_FOUND'));
          return;
        }
        setCourse(body.data);
      } catch {
        if (active) setError(getCreateCourseErrorMessage(null));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [organizationId, courseId]);

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
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Course Details</p>
          <LinkButton href="/dashboard/organization/courses" variant="ghost" size="sm">
            Back to My Courses
          </LinkButton>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          {error ? (
            <FormError message={error} />
          ) : loading ? (
            <div className="flex items-center gap-3 text-neutral-700">
              <Spinner size="md" label="Loading course..." />
              <span>Loading course...</span>
            </div>
          ) : course ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-neutral-900">{course.title}</h1>
                  <p className="mt-1 text-sm text-neutral-500">{course.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusBadgeVariant(course.status)} size="sm">
                    {course.status}
                  </Badge>
                  <LinkButton href={`/dashboard/organization/courses/${courseId}/modules`} size="sm" variant="primary">
                    Manage Modules
                  </LinkButton>
                </div>
              </div>

              <dl className="mt-6 space-y-4">
                <div>
                  <dt className="text-sm font-medium text-neutral-500">Description</dt>
                  <dd className="mt-1 text-sm text-neutral-900">{course.description ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-neutral-500">Thumbnail URL</dt>
                  <dd className="mt-1 break-all text-sm text-neutral-900">{course.thumbnailUrl ?? '—'}</dd>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-neutral-500">Category</dt>
                    <dd className="mt-1 text-sm text-neutral-900">{course.category ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-neutral-500">Difficulty</dt>
                    <dd className="mt-1 text-sm text-neutral-900">{course.difficulty ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-neutral-500">Price</dt>
                    <dd className="mt-1 text-sm text-neutral-900">{formatMoney(course.price)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-neutral-500">Discount price</dt>
                    <dd className="mt-1 text-sm text-neutral-900">{formatMoney(course.discountPrice)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-neutral-500">Estimated minutes</dt>
                    <dd className="mt-1 text-sm text-neutral-900">{course.estimatedMinutes ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-neutral-500">Created</dt>
                    <dd className="mt-1 text-sm text-neutral-900">
                      {new Date(course.createdAt).toLocaleDateString()}
                    </dd>
                  </div>
                </div>
                <div>
                  <dt className="text-sm font-medium text-neutral-500">Learning objectives</dt>
                  <dd className="mt-1">
                    {course.learningObjectives && course.learningObjectives.length > 0 ? (
                      <ul className="list-inside list-disc space-y-1 text-sm text-neutral-900">
                        {course.learningObjectives.map((objective, index) => (
                          <li key={index}>{objective}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-sm text-neutral-900">—</span>
                    )}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <Alert variant="warning" title="Course unavailable">
              This course could not be loaded.
            </Alert>
          )}
        </div>
      </div>
    </main>
  );
}
