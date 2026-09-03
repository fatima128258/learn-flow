'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Alert, Spinner } from '../../../../../components/ui';
import { LinkButton } from '../../../../../components/ui/LinkButton';
import { getCreateCourseErrorMessage } from '../../../../../features/course/createCourseErrors';
import { useToast } from '../../../../../components/ui/ToastProvider';
import { useCurrentUser } from '../../../../../features/auth/useCurrentUser';

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

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'REVIEW', label: 'In Review' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
] as const;

function formatMoney(value: number | string | null): string {
  if (value === null || value === undefined) return '—';
  return String(value);
}

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = typeof params.courseId === 'string' ? params.courseId : null;
  const toast = useToast();
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Check auth and set organizationId
  useEffect(() => {
    if (userLoading) return;

    const role = user?.role;
    if (role !== 'ORG_ADMIN' && role !== 'INSTRUCTOR') {
      window.location.href = '/login';
      return;
    }

    const orgId = user?.organizationId ?? null;
    if (!orgId) {
      window.location.href = '/login';
      return;
    }

    setOrganizationId(orgId);
    setCheckingAuth(false);
  }, [user, userLoading]);

  useEffect(() => {
    if (!organizationId || !courseId) return;
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const apiBase = '';
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
          toast.error(getCreateCourseErrorMessage(code));
          return;
        }
        const body: GetCourseResponse = await res.json();
        if (!active) return;
        if (!body.data) {
          toast.error(getCreateCourseErrorMessage('COURSE_NOT_FOUND'));
          return;
        }
        setCourse(body.data);
      } catch {
        if (active) toast.error(getCreateCourseErrorMessage(null));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [organizationId, courseId, toast]);

  async function handleStatusChange(newStatus: string) {
    if (!organizationId || !courseId || !course) return;
    setUpdatingStatus(true);
    try {
      const apiBase = '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/courses/${courseId}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!res.ok) {
        let code: unknown = null;
        try {
          code = (await res.json())?.error;
        } catch {
          code = null;
        }
        toast.error(getCreateCourseErrorMessage(code));
        return;
      }

      const body = await res.json();
      if (body.data) {
        setCourse(body.data);
        toast.success(`Course status updated to ${newStatus}`);
      }
    } catch {
      toast.error(getCreateCourseErrorMessage(null));
    } finally {
      setUpdatingStatus(false);
    }
  }

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
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Course Details</p>
          <LinkButton href={`/dashboard/organization/courses${organizationId ? `?organization=${organizationId}` : ''}`} variant="ghost" size="sm">
            Back to My Courses
          </LinkButton>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          {loading ? (
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
                  <select
                    value={course.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={updatingStatus}
                    className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <LinkButton href={`/dashboard/organization/courses/${courseId}/modules${organizationId ? `?organization=${organizationId}` : ''}`} size="sm" variant="primary">
                    Manage Modules
                  </LinkButton>
                  <LinkButton href={`/dashboard/organization/courses/${courseId}/edit${organizationId ? `?organization=${organizationId}` : ''}`} size="sm" variant="secondary">
                    Edit
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
    </div>
  );
}
