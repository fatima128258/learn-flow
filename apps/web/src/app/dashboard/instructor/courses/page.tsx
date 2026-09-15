'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  EmptyState,
  EmptyStateIcons,
  ErrorState,
  LinkButton,
  Spinner,
  ViewToggle,
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
  tableActionClass,
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

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-status-title"
        className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-7 shadow-xl"
      >
        <div className="mb-5 flex items-start justify-between gap-2">
          <div>
            <h2 id="change-status-title" className="text-lg font-medium text-[#64748b] line-clamp-1">{course.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600" aria-label="Close">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-5 flex items-center gap-2 rounded-xl bg-[#f7f9fc] px-4 py-3 text-base text-[#64748b]">
          <span>Current:</span>
          <span className="rounded-full bg-[#fff1bd] px-3 py-1 text-sm font-medium text-[#b77900]">{course.status}</span>
        </div>

        <fieldset className="space-y-2.5">
          <legend className="mb-3 text-base font-semibold text-[#475569]">Select new status</legend>
          {STATUS_OPTIONS.map((opt) => {
            const isCurrent = opt.value === course.status;
            const isSelected = opt.value === selected;
            return (
              <label key={opt.value} className={`flex cursor-pointer items-start gap-4 rounded-xl border px-4 py-4 transition-colors ${isSelected ? 'border-[#c8a98f] bg-[#fffaf3]' : 'border-[#dbe3ed] bg-white hover:border-[#c8a98f] hover:bg-[#fffaf3]'}`}>
                <input type="radio" name="status" value={opt.value} checked={isSelected} onChange={() => setSelected(opt.value)} className="mt-0.5 h-5 w-5 accent-[#8d6b57]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-[#273449]">{opt.label}</span>
                    {isCurrent && <span className="rounded-full bg-[#edf1f5] px-2 py-0.5 text-sm text-[#aeb9c7]">current</span>}
                  </div>
                  <p className="mt-1 text-sm text-[#71819a]">{opt.description}</p>
                </div>
              </label>
            );
          })}
        </fieldset>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border-0 bg-transparent px-4 py-2 text-base font-medium text-[#475569] hover:bg-neutral-50 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} disabled={!isDirty || saving} className="inline-flex items-center gap-2 rounded-lg bg-[#5a321f] px-5 py-2 text-base font-semibold text-white hover:bg-[#472719] disabled:cursor-not-allowed disabled:bg-[#b9a89f]">
            {saving && <Spinner size="sm" />}
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InstructorCoursesPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const [statusModalCourseId, setStatusModalCourseId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

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
    void queryClient.invalidateQueries({
      queryKey: ['instructor', 'courses', user?.organizationId, user?.id],
    });
  }

  const orgId = user?.organizationId ?? '';
  const manageHref = (courseId: string) =>
    `/dashboard/instructor/courses/${courseId}${orgId ? `?organization=${orgId}` : ''}`;

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
            <LinkButton href="/dashboard/instructor/courses/new">
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
              action={{ label: 'Create your first course', onClick: () => { window.location.href = '/dashboard/instructor/courses/new'; } }}
            />
          </div>
        ) : (
          <TableCard
            action={<ViewToggle value={viewMode} onChange={setViewMode} storageKey="learnhub-instructor-courses-view" />}
          >
            {viewMode === 'table' ? (
              <>
            <div className="block">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className={tableHeadClass}>Title</th>
                    <th className={tableHeadClass}>Difficulty</th>
                    <th className={tableHeadClass}>Status</th>
                    <th className={tableHeadClass}>Created</th>
                    <th className={`${tableHeadClass} text-center w-10`}>Action</th>
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
                      <td className={tableActionClass}>
                        <div className="flex items-center justify-center">
                          <CourseActionsMenu
                            courseId={course.id}
                            manageHref={manageHref(course.id)}
                            onChangeStatusClick={() => setStatusModalCourseId(course.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

              </>
            ) : (
              <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {courses?.map((course) => (
                  <article key={course.id} className="flex min-h-44 flex-col rounded-2xl border border-[#ead8c6] bg-[#fffdf9] p-5 shadow-sm transition-shadow hover:border-[#c9a98e] hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="min-w-0 font-semibold leading-snug text-[#5a321f]">{course.title}</h2>
                      <CourseActionsMenu
                        courseId={course.id}
                        manageHref={manageHref(course.id)}
                        onChangeStatusClick={() => setStatusModalCourseId(course.id)}
                      />
                    </div>
                    <div className="mt-auto space-y-3 border-t border-[#ead8c6] pt-4 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-900">Status</p>
                        <Badge variant={statusBadgeVariant(course.status)} size="sm">{course.status}</Badge>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-900">Created</p>
                        <p className="font-medium text-neutral-900">{new Date(course.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </TableCard>
        )}
      </div>
    </>
  );
}
