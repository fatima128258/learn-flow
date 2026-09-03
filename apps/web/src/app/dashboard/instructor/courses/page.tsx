'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  EmptyState,
  EmptyStateIcons,
  ErrorState,
  LinkButton,
  Spinner,
} from '@/components/ui';
import { useToast } from '@/components/ui/ToastProvider';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { getJson } from '@/lib/api';
import { getCourseStatusErrorMessage } from '@/features/course/courseStatusErrors';
import {
  PageHeader,
  TableCard,
  tableHeadClass,
  tableCellClass,
  tableRowHoverClass,
  CourseActionsMenu,
} from '@/components/dashboard';

// ─── Types ────────────────────────────────────────────────────────────────────

type CourseItem = {
  id: string;
  title: string;
  status: string;
  difficulty: string | null;
  createdAt: string;
};

type CourseStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';

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
  return 'warning' as const;
}

// ─── Change-Status Modal ──────────────────────────────────────────────────────

interface ChangeStatusModalProps {
  course: CourseItem;
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
      if (!res.ok) { toast.error(getCourseStatusErrorMessage(code)); return; }
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
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
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
          <button onClick={onClose} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600" aria-label="Close">
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
              <label key={opt.value} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${isSelected ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'} ${isCurrent ? 'opacity-60' : ''}`}>
                <input type="radio" name="status" value={opt.value} checked={isSelected} onChange={() => setSelected(opt.value)} className="mt-0.5 h-4 w-4 accent-primary-600" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-900">{opt.label}</span>
                    {isCurrent && <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-500">current</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">{opt.description}</p>
                </div>
              </label>
            );
          })}
        </fieldset>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} disabled={!isDirty || saving} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">
            {saving && <Spinner size="sm" />}
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InstructorCoursesPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const [statusModalCourseId, setStatusModalCourseId] = useState<string | null>(null);

  const { data: courses, isLoading, isError, refetch } = useQuery({
    // Include both organizationId and user id in the cache key so that cached
    // courses from one instructor / organization are never served to a different
    // instructor or organization in the same browser session.
    queryKey: ['instructor', 'courses', user?.organizationId, user?.id],
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
    if (!user) {
      window.location.href = '/login';
      return;
    }
    // Only allow INSTRUCTOR role on this page
    if (user.role !== 'INSTRUCTOR') {
      window.location.href =
        user.role === 'ORG_ADMIN' ? '/dashboard/organization'
        : user.role === 'PLATFORM_ADMIN' ? '/dashboard'
        : user.role === 'STUDENT' ? '/dashboard/student'
        : '/login';
    }
  }, [user, userLoading]);

  function handleStatusSuccess(courseId: string, newStatus: CourseStatus) {
    // Must use the same full cache key as the useQuery above so the optimistic
    // update targets the correct cache entry.
    queryClient.setQueryData<CourseItem[]>(
      ['instructor', 'courses', user?.organizationId, user?.id],
      (prev) => prev?.map((c) => (c.id === courseId ? { ...c, status: newStatus } : c)) ?? [],
    );
  }

  const orgId = user?.organizationId ?? '';
  const manageHref = (courseId: string) =>
    `/dashboard/organization/courses/${courseId}${orgId ? `?organization=${orgId}` : ''}`;

  const activeModal = courses?.find((c) => c.id === statusModalCourseId) ?? null;

  return (
    <>
      {activeModal && orgId && (
        <ChangeStatusModal
          course={activeModal}
          organizationId={orgId}
          onClose={() => setStatusModalCourseId(null)}
          onSuccess={handleStatusSuccess}
        />
      )}

      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="My Courses"
          actions={
            <LinkButton href={`/dashboard/organization/courses/new${orgId ? `?organization=${orgId}` : ''}`}>
              Create Course
            </LinkButton>
          }
        />

        {isLoading ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 p-6 text-neutral-700">
              <Spinner size="lg" label="Loading your courses..." />
              <span>Loading your courses...</span>
            </div>
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState title="Unable to load your courses" message="Your course list could not be loaded. Please try again." action={{ label: 'Retry', onClick: () => void refetch() }} />
          </div>
        ) : courses && courses.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <EmptyState
              icon={EmptyStateIcons.NoCourses}
              title="No courses yet"
              description="Create your first course to start teaching."
              action={{ label: 'Create your first course', onClick: () => { window.location.href = `/dashboard/organization/courses/new${orgId ? `?organization=${orgId}` : ''}`; } }}
            />
          </div>
        ) : (
          <TableCard
            title="My Courses"
            description={`${courses?.length ?? 0} course${(courses?.length ?? 0) !== 1 ? 's' : ''}`}
            action={<LinkButton href={`/dashboard/organization/courses/new${orgId ? `?organization=${orgId}` : ''}`} size="sm">New Course</LinkButton>}
          >
            {/* Desktop */}
            <div className="hidden md:block">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className={tableHeadClass}>Title</th>
                    <th className={tableHeadClass}>Difficulty</th>
                    <th className={tableHeadClass}>Status</th>
                    <th className={tableHeadClass}>Created</th>
                    <th className={`${tableHeadClass} w-10`}></th>
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
                      <td className={`${tableCellClass} text-neutral-600`}>{new Date(course.createdAt).toLocaleDateString()}</td>
                      <td className={`${tableCellClass} text-right`}>
                        <CourseActionsMenu
                          courseId={course.id}
                          manageHref={manageHref(course.id)}
                          onChangeStatusClick={() => setStatusModalCourseId(course.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="space-y-3 p-3 md:hidden">
              {courses?.map((course) => (
                <div key={course.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-neutral-900 leading-snug">{course.title}</p>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={statusBadgeVariant(course.status)} size="sm">{course.status}</Badge>
                      <CourseActionsMenu
                        courseId={course.id}
                        manageHref={manageHref(course.id)}
                        onChangeStatusClick={() => setStatusModalCourseId(course.id)}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                    <span>{course.difficulty ?? '—'}</span>
                    <span>{new Date(course.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </TableCard>
        )}
      </div>
    </>
  );
}
