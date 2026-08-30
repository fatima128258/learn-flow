'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  EmptyState,
  EmptyStateIcons,
  ErrorState,
  Spinner,
} from '@/components/ui';
import { PageHeader, StatCard } from '@/components/dashboard';

type MeResponse = {
  user?: {
    id?: string;
    name?: string | null;
    email?: string;
    role?: string | null;
    organizationId?: string | null;
  };
};

type EnrolledCourse = {
  enrollmentId: string;
  enrollmentStatus: string;
  enrolledAt: string;
  courseId: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  category: string | null;
  difficulty: string | null;
  estimatedMinutes: number | null;
  learningObjectives: string[];
};

const BookIcon = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5.4" />
  </svg>
);

const TagIcon = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

const ClockIcon = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l2 2m6 0a8 8 0 11-16 0 8 8 0 0116 0z" />
  </svg>
);

const categoryFallback = (title: string) => {
  const palettes = [
    'from-primary-500 to-primary-700',
    'from-accent-500 to-accent-700',
    'from-success-500 to-teal-600',
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) hash = (hash << 5) - hash + title.charCodeAt(i);
  return palettes[Math.abs(hash) % palettes.length];
};

export default function StudentDashboardPage() {
  const [user, setUser] = useState<{ name?: string | null; email?: string } | null>(null);
  const [courses, setCourses] = useState<EnrolledCourse[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

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
        if (meData.user?.role !== 'STUDENT') {
          window.location.href = '/login';
          return;
        }
        const orgId = meData.user?.organizationId ?? null;
        if (!orgId) {
          window.location.href = '/login';
          return;
        }
        setUser({
          name: meData.user?.name ?? 'Student',
          email: meData.user?.email ?? '',
        });
        setOrganizationId(orgId);
        await loadCourses(orgId);
      } catch {
        if (active) window.location.href = '/login';
      } finally {
        if (active) setLoading(false);
      }
    }

    guard();
    return () => {
      active = false;
    };
  }, []);

  async function loadCourses(orgId: string) {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/v1/organizations/${orgId}/student/courses`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setError('Could not load your courses. Please try again.');
        return;
      }
      const body = await res.json();
      setCourses(body.data ?? []);
    } catch {
      setError('Could not reach the server. Please try again.');
    }
  }

  const enrolled = courses ?? [];
  const categoryCount = new Set(enrolled.map((c) => c.category).filter(Boolean)).size;
  const totalMinutes = enrolled.reduce<number>(
    (sum, c) => sum + (c.estimatedMinutes ?? 0),
    0,
  );
  const estHours = totalMinutes > 0 ? `${Math.round(totalMinutes / 60)}h` : '0h';

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 text-neutral-700">
          <Spinner size="lg" label="Loading dashboard..." />
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        subtitle="Student Dashboard"
        title={`Welcome back${user?.name ? `, ${user.name}` : ''}`}
        description={user?.email}
        actions={
          <>
            <Link href="/courses">
              <Button size="sm" variant="outline">Browse Courses</Button>
            </Link>
            <Link href="/dashboard/student/search">
              <Button size="sm" variant="primary">Search &amp; Enroll</Button>
            </Link>
            <Link href="/dashboard/student/notifications">
              <Button size="sm" variant="outline">Notifications</Button>
            </Link>
          </>
        }
      />

      {error ? (
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <ErrorState
            title="Unable to load courses"
            message={error}
            action={{ label: 'Retry', onClick: () => organizationId && loadCourses(organizationId) }}
          />
        </div>
      ) : courses !== null && courses.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <EmptyState
            icon={EmptyStateIcons.NoCourses}
            title="No enrolled courses yet"
            description="Browse the course catalog and enroll in courses to start learning."
            action={{
              label: 'Browse Courses',
              onClick: () => { window.location.href = '/courses'; },
            }}
          />
        </div>
      ) : courses !== null ? (
        <>
          {/* Real, derived metrics */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Enrolled courses"
              value={enrolled.length}
              hint="Courses on your path"
              icon={BookIcon}
              tone="primary"
            />
            <StatCard
              label="Topics exploring"
              value={categoryCount}
              hint="Distinct course categories"
              icon={TagIcon}
              tone="info"
            />
            <StatCard
              label="Est. learning time"
              value={estHours}
              hint="Across all enrolled content"
              icon={ClockIcon}
              tone="success"
            />
          </div>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">My Enrolled Courses</h2>
            <span className="text-sm text-neutral-500">
              {enrolled.length} course{enrolled.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {enrolled.map((course) => (
              <Link key={course.courseId} href={`/dashboard/student/courses/${course.courseId}`}>
                <div className="group h-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md">
                  {course.thumbnailUrl ? (
                    <div className="h-32 w-full overflow-hidden bg-neutral-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={course.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className={`h-32 w-full bg-gradient-to-br ${categoryFallback(course.title)}`} aria-hidden="true" />
                  )}
                  <div className="p-5">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {course.category && (
                        <Badge variant="primary" size="sm">{course.category}</Badge>
                      )}
                      {course.difficulty && (
                        <Badge variant="default" size="sm">{course.difficulty}</Badge>
                      )}
                    </div>
                    <h3 className="line-clamp-2 text-lg font-semibold text-neutral-900 transition-colors group-hover:text-primary-600">
                      {course.title}
                    </h3>
                    {course.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{course.description}</p>
                    )}
                    <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4 text-sm text-neutral-500">
                      <span>
                        {course.estimatedMinutes
                          ? `${Math.round(course.estimatedMinutes / 60)}h ${course.estimatedMinutes % 60}m`
                          : 'Self-paced'}
                      </span>
                      <Badge variant="success" size="sm">Enrolled</Badge>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}