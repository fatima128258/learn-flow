'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge, EmptyState, EmptyStateIcons, Spinner } from '../../../../components/ui';
import { LinkButton } from '../../../../components/ui/LinkButton';
import { getListCoursesErrorMessage } from '../../../../features/course/listCoursesErrors';
import { getCourseStatusErrorMessage } from '../../../../features/course/courseStatusErrors';
import { useToast } from '../../../../components/ui/ToastProvider';
import {
  PageHeader,
  TableCard,
  tableHeadClass,
  tableCellClass,
  tableRowHoverClass,
  CourseActionsMenu,
} from '../../../../components/dashboard';
import { useCurrentUser } from '../../../../features/auth/useCurrentUser';

// ─── Types ────────────────────────────────────────────────────────────────────

type CourseListItem = {
  id: string;
  title: string;
  slug: string;
  status: string;
  difficulty: string | null;
  createdAt: string;
};

type CourseStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';

type ListCoursesResponse = {
  success?: boolean;
  data?: CourseListItem[];
  error?: string;
};

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
  return 'warning' as const; // DRAFT
}

// ─── Change-Status Modal ──────────────────────────────────────────────────────

interface ChangeStatusModalProps {
  course: CourseListItem;
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

      if (!res.ok) {
        toast.error(getCourseStatusErrorMessage(code));
        return;
      }

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
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
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
          <button
            onClick={onClose}
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="Close"
          >
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
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                } ${isCurrent ? 'opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  name="status"
                  value={opt.value}
                  checked={isSelected}
                  onChange={() => setSelected(opt.value)}
                  className="mt-0.5 h-4 w-4 accent-primary-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-900">{opt.label}</span>
                    {isCurrent && (
                      <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-500">
                        current
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">{opt.description}</p>
                </div>
              </label>
            );
          })}
        </fieldset>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isDirty || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Spinner size="sm" />}
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyCoursesPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const orgIdParam = searchParams.get('organization');
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseListItem[] | null>(null);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [statusModalCourseId, setStatusModalCourseId] = useState<string | null>(null);

  // Extract organizationId from URL param or user context, perform role check
  useEffect(() => {
    if (userLoading) return;
    
    if (!user) {
      window.location.href = '/login';
      return;
    }
    
    const role = user.role;
    if (role !== 'ORG_ADMIN' && role !== 'INSTRUCTOR' && role !== 'PLATFORM_ADMIN') {
      window.location.href = '/login';
      return;
    }
    
    const orgId = orgIdParam ?? user.organizationId ?? null;
    if (!orgId) {
      window.location.href = '/login';
      return;
    }
    
    setOrganizationId(orgId);
  }, [user, userLoading, orgIdParam]);

  // Load courses once organizationId is set
  useEffect(() => {
    if (!organizationId) return;
    let active = true;

    async function load() {
      setCoursesLoading(true);
      try {
        const apiBase = '';
        const res = await fetch(
          `${apiBase}/api/v1/organizations/${organizationId}/courses`,
          { credentials: 'include' },
        );
        if (!active) return;
        if (!res.ok) {
          let code: unknown = null;
          try { code = (await res.json())?.error; } catch { /* ignore */ }
          toast.error(getListCoursesErrorMessage(code));
          return;
        }
        const body: ListCoursesResponse = await res.json();
        if (!active) return;
        setCourses(body.data ?? []);
      } catch {
        if (active) toast.error(getListCoursesErrorMessage(null));
      } finally {
        if (active) setCoursesLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [organizationId, toast]);

  // Optimistic local update — no full reload needed
  function handleStatusSuccess(courseId: string, newStatus: CourseStatus) {
    setCourses((prev) =>
      prev?.map((c) => (c.id === courseId ? { ...c, status: newStatus } : c)) ?? [],
    );
  }

  const activeModal = courses?.find((c) => c.id === statusModalCourseId) ?? null;

  if (userLoading) {
    return (
      <div className="mx-auto flex max-w-3xl items-center gap-3 text-neutral-700">
        <Spinner size="lg" label="Loading..." />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <>
      {activeModal && organizationId && (
        <ChangeStatusModal
          course={activeModal}
          organizationId={organizationId}
          onClose={() => setStatusModalCourseId(null)}
          onSuccess={handleStatusSuccess}
        />
      )}

      <div>
        <div className="mx-auto max-w-5xl">
          <PageHeader
            actions={
              <LinkButton
                href={`/dashboard/organization/courses/new${organizationId ? `?organization=${organizationId}` : ''}`}
                size="sm"
              >
                Create Course
              </LinkButton>
            }
          />

          {coursesLoading ? (
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
                    window.location.href = `/dashboard/organization/courses/new${organizationId ? `?organization=${organizationId}` : ''}`;
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
              {/* ── Desktop table ── */}
              <div className="hidden md:block overflow-visible">
                <table className="min-w-full divide-y divide-neutral-200 overflow-visible">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className={tableHeadClass}>Title</th>
                      <th className={tableHeadClass}>Slug</th>
                      <th className={tableHeadClass}>Status</th>
                      <th className={tableHeadClass}>Difficulty</th>
                      <th className={tableHeadClass}>Created</th>
                      <th className={`${tableHeadClass} text-right`}></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {courses.map((course) => (
                      <tr key={course.id} className={tableRowHoverClass}>
                        <td className={`${tableCellClass} font-medium text-primary-600 hover:text-primary-700`}>
                          <a href={`/dashboard/organization/courses/${course.id}${organizationId ? `?organization=${organizationId}` : ''}`}>
                            {course.title}
                          </a>
                        </td>
                        <td className={`${tableCellClass} text-neutral-700`}>{course.slug}</td>
                        <td className={tableCellClass}>
                          <Badge variant={statusBadgeVariant(course.status)} size="sm">
                            {course.status}
                          </Badge>
                        </td>
                        <td className={`${tableCellClass} text-neutral-700`}>{course.difficulty ?? '—'}</td>
                        <td className={`${tableCellClass} text-neutral-700`}>
                          {new Date(course.createdAt).toLocaleDateString()}
                        </td>
                        <td className={`${tableCellClass} text-right`}>
                          <CourseActionsMenu
                            courseId={course.id}
                            manageHref={`/dashboard/organization/courses/${course.id}${organizationId ? `?organization=${organizationId}` : ''}`}
                            onChangeStatusClick={() => setStatusModalCourseId(course.id)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Mobile cards ── */}
              <div className="space-y-3 p-3 md:hidden">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <a
                        href={`/dashboard/organization/courses/${course.id}${organizationId ? `?organization=${organizationId}` : ''}`}
                        className="font-semibold text-primary-600 leading-snug hover:underline"
                      >
                        {course.title}
                      </a>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={statusBadgeVariant(course.status)} size="sm">
                          {course.status}
                        </Badge>
                        <CourseActionsMenu
                          courseId={course.id}
                          manageHref={`/dashboard/organization/courses/${course.id}${organizationId ? `?organization=${organizationId}` : ''}`}
                          onChangeStatusClick={() => setStatusModalCourseId(course.id)}
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">{course.slug}</p>
                    <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                      <span>{course.difficulty ?? '—'}</span>
                      <span>{new Date(course.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </TableCard>
          ) : null}
        </div>
      </div>
    </>
  );
}
