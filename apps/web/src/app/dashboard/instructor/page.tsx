'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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

// Available status options
const STATUS_OPTIONS = [
  { value: 'PUBLISHED', label: 'Publish', description: 'Visible to students' },
  { value: 'REVIEW', label: 'Send for Review', description: 'Needs approval' },
  { value: 'DRAFT', label: 'Save as Draft', description: 'Only visible to you' },
  { value: 'ARCHIVED', label: 'Archive', description: 'Hidden from students' },
];

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
  const toast = useToast();
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

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

  async function handleStatusChange(courseId: string, newStatus: string) {
    if (!user?.organizationId) {
      toast.error('Organization ID is missing');
      return;
    }
    
    setUpdatingStatus(courseId);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${user.organizationId}/courses/${courseId}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!res.ok) {
        toast.error('Failed to update course status');
        return;
      }

      const body = await res.json();
      if (body.data) {
        // Refetch courses to update the UI
        await refetch();
        toast.success(`Course status updated to ${newStatus}`);
      }
    } catch {
      toast.error('Failed to update course status');
    } finally {
      setUpdatingStatus(null);
    }
  }

  const publishedCount = (courses ?? []).filter((c) => c.status === 'PUBLISHED').length;
  const draftCount = (courses?.length ?? 0) - publishedCount;

  // Dropdown component for status changes
  const StatusDropdown = ({ courseId, currentStatus }: { courseId: string; currentStatus: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [localUpdating, setLocalUpdating] = useState(false);

    const handleStatusSelect = async (status: string) => {
      if (status === currentStatus) {
        setIsOpen(false);
        return;
      }
      
      setLocalUpdating(true);
      await handleStatusChange(courseId, status);
      setLocalUpdating(false);
      setIsOpen(false);
    };

    return (
      <div className="relative inline-block text-left">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={localUpdating || updatingStatus === courseId}
          className="inline-flex items-center justify-center rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Change status"
        >
          {localUpdating || updatingStatus === courseId ? (
            <Spinner size="sm" />
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 z-10 mt-1 w-56 origin-top-right rounded-lg border border-neutral-200 bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div className="px-2 py-1.5 text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Change Status
            </div>
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusSelect(option.value)}
                disabled={localUpdating || updatingStatus === courseId}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  currentStatus === option.value
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-neutral-700 hover:bg-neutral-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-neutral-500">{option.description}</div>
              </button>
            ))}
            <div className="border-t border-neutral-200 pt-1">
              <button
                onClick={() => setIsOpen(false)}
                className="block w-full px-3 py-2 text-left text-sm text-neutral-500 hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
          title={`Welcome, ${user?.name ?? 'Instructor'}`}
          actions={
            <LinkButton href={`/dashboard/organization/courses/new${user?.organizationId ? `?organization=${user.organizationId}` : ''}`}>Create Course</LinkButton>
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
              action={{ label: 'Create your first course', onClick: () => { window.location.href = `/dashboard/organization/courses/new${user?.organizationId ? `?organization=${user.organizationId}` : ''}`; } }}
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
                <LinkButton href={`/dashboard/organization/courses/new${user?.organizationId ? `?organization=${user.organizationId}` : ''}`} size="sm">
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
                          <div className="flex items-center justify-end gap-2">
                            <StatusDropdown courseId={course.id} currentStatus={course.status} />
                            <LinkButton href={`/dashboard/organization/courses/${course.id}${user?.organizationId ? `?organization=${user.organizationId}` : ''}`} size="sm" variant="outline">
                              Manage
                            </LinkButton>
                          </div>
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
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex-1">
                        <StatusDropdown courseId={course.id} currentStatus={course.status} />
                      </div>
                      <LinkButton href={`/dashboard/organization/courses/${course.id}${user?.organizationId ? `?organization=${user.organizationId}` : ''}`} size="sm" variant="outline">
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
