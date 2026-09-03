'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Badge,
  EmptyState,
  EmptyStateIcons,
  ErrorState,
  Spinner,
} from '@/components/ui';
import { useCurrentUser } from '@/features/auth/useCurrentUser';

type StatsResponse = {
  availableCourses: number;
  enrolledCourses: number;
  certificatesEarned: number;
  completedCourses: number;
  inProgressCourses: number;
  categoriesExplored: number;
  totalEstimatedMinutes: number;
  totalEstimatedHours: number;
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
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5.4" />
  </svg>
);

const TagIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

const ClockIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l2 2m6 0a8 8 0 11-16 0 8 8 0 0116 0z" />
  </svg>
);

const CertificateIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
  </svg>
);

const AvailableCoursesIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

const ProgressIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
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
  const { data: user, isLoading: userLoading, error: userError } = useCurrentUser();
  const [courses, setCourses] = useState<EnrolledCourse[] | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Extract organizationId from user and perform role check
  useEffect(() => {
    if (userLoading) return;
    
    if (!user) {
      window.location.href = '/login';
      return;
    }
    
    if (user.role !== 'STUDENT') {
      window.location.href = '/login';
      return;
    }
    
    const orgId = user.organizationId ?? null;
    if (!orgId) {
      window.location.href = '/login';
      return;
    }
    
    setOrganizationId(orgId);
  }, [user, userLoading]);

  // Load courses once organizationId is set
  useEffect(() => {
    if (!organizationId) return;
    let active = true;

    async function loadCourses() {
      setCoursesLoading(true);
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        const [coursesRes, statsRes] = await Promise.all([
          fetch(`${apiBase}/api/v1/organizations/${organizationId}/student/courses`, {
            credentials: 'include',
          }),
          fetch(`${apiBase}/api/v1/organizations/${organizationId}/student/stats`, {
            credentials: 'include',
          }),
        ]);

        if (!active) return;

        if (!coursesRes.ok) {
          setError('Could not load your courses. Please try again.');
          return;
        }

        const coursesBody = await coursesRes.json();
        if (!active) return;
        setCourses(coursesBody.data ?? []);

        if (statsRes.ok) {
          const statsBody = await statsRes.json();
          if (active) setStats(statsBody.data ?? null);
        }
      } catch {
        if (active) setError('Could not reach the server. Please try again.');
      } finally {
        if (active) setCoursesLoading(false);
      }
    }

    loadCourses();
    return () => {
      active = false;
    };
  }, [organizationId]);

  const enrolled = courses ?? [];
  const categoryCount = new Set(enrolled.map((c) => c.category).filter(Boolean)).size;
  const totalMinutes = enrolled.reduce<number>(
    (sum, c) => sum + (c.estimatedMinutes ?? 0),
    0,
  );
  const estHours = totalMinutes > 0 ? `${Math.round(totalMinutes / 60)}h` : '0h';

  const handleRetryCourses = async () => {
    if (organizationId) {
      setCoursesLoading(true);
      setError(null);
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        const [coursesRes, statsRes] = await Promise.all([
          fetch(`${apiBase}/api/v1/organizations/${organizationId}/student/courses`, {
            credentials: 'include',
          }),
          fetch(`${apiBase}/api/v1/organizations/${organizationId}/student/stats`, {
            credentials: 'include',
          }),
        ]);

        if (!coursesRes.ok) {
          setError('Could not load your courses. Please try again.');
          return;
        }

        const coursesBody = await coursesRes.json();
        setCourses(coursesBody.data ?? []);

        if (statsRes.ok) {
          const statsBody = await statsRes.json();
          setStats(statsBody.data ?? null);
        }
      } catch {
        setError('Could not reach the server. Please try again.');
      } finally {
        setCoursesLoading(false);
      }
    }
  };

  if (userLoading || (courses === null && coursesLoading)) {
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

      {error ? (
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <ErrorState
            title="Unable to load courses"
            message={error}
            action={{ label: 'Retry', onClick: handleRetryCourses }}
          />
        </div>
      ) : courses !== null && courses.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <EmptyState
            icon={EmptyStateIcons.NoCourses}
            title="No enrolled courses yet"
            description="Search for courses in the catalog and enroll to start learning."
            action={{
              label: 'Search Courses',
              onClick: () => { window.location.href = '/dashboard/student/search'; },
            }}
          />
        </div>
      ) : courses !== null ? (
        <>
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