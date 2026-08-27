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

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto flex max-w-5xl items-center gap-3 text-neutral-700">
          <Spinner size="lg" label="Loading dashboard..." />
          <span>Loading dashboard...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-primary-600">Student Dashboard</p>
          <h1 className="mt-2 text-3xl font-bold text-neutral-900">
            Welcome back{user?.name ? `, ${user.name}` : ''}
          </h1>
          {user ? (
            <div className="mt-3 text-neutral-600">
              <p>{user.email}</p>
            </div>
          ) : null}
          <div className="mt-4 flex items-center gap-3">
            <Link href="/courses">
              <Button size="sm" variant="outline">Browse Courses</Button>
            </Link>
          </div>
        </div>

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
            <h2 className="mb-4 text-lg font-semibold text-neutral-900">My Enrolled Courses</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <Link key={course.courseId} href={`/dashboard/student/courses/${course.courseId}`}>
                  <div className="group rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-all hover:border-primary-200 hover:shadow-md cursor-pointer">
                    <div className="mb-3 flex items-center gap-2">
                      {course.category && (
                        <Badge variant="primary" size="sm">{course.category}</Badge>
                      )}
                      {course.difficulty && (
                        <Badge variant="default" size="sm">{course.difficulty}</Badge>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors line-clamp-2">
                      {course.title}
                    </h3>
                    {course.description && (
                      <p className="mt-2 text-sm text-neutral-600 line-clamp-2">{course.description}</p>
                    )}
                    <div className="mt-4 flex items-center justify-between text-sm text-neutral-500">
                      <span>
                        {course.estimatedMinutes
                          ? `${Math.round(course.estimatedMinutes / 60)}h ${course.estimatedMinutes % 60}m`
                          : 'Self-paced'}
                      </span>
                      <Badge variant="success" size="sm">Enrolled</Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
