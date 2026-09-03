'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Badge,
  Button,
  EmptyState,
  EmptyStateIcons,
  ErrorState,
  Input,
} from '@/components/ui';
import { PageHeader } from '@/components/dashboard';
import { useCurrentUser } from '@/features/auth/useCurrentUser';

type CourseHit = {
  id: string;
  organizationId: string;
  instructor: { id: string; name: string | null };
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  category: string | null;
  difficulty: string | null;
  price: number | null;
  discountPrice: number | null;
  estimatedMinutes: number | null;
  learningObjectives: string[];
  status: string;
  publishedAt: string | null;
  isEnrolled: boolean;
};

function formatPrice(value: number | null) {
  if (value === null || value === undefined) return 'Free';
  if (value === 0) return 'Free';
  return `$${Number(value).toFixed(2)}`;
}

export default function StudentSearchPage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [results, setResults] = useState<CourseHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [navigatingCourseId, setNavigatingCourseId] = useState<string | null>(null);
  const router = useRouter();

  // Check auth and set organizationId
  useEffect(() => {
    if (userLoading) return;
    
    if (!user) {
      router.push('/login');
      return;
    }
    
    if (user.role !== 'STUDENT') {
      router.push('/login');
      return;
    }
    
    const orgId = user.organizationId ?? null;
    if (!orgId) {
      router.push('/login');
      return;
    }
    
    setOrganizationId(orgId);
  }, [user, userLoading]);

  async function runSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!organizationId) return;

    setLoading(true);
    setSearchError(null);
    try {
      const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL || '';
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      const qs = params.toString();

      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/student/search${qs ? `?${qs}` : ''}`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        setSearchError('Could not search courses. Please try again.');
        return;
      }
      const body = await res.json();
      setResults(body.data ?? []);
      setSubmittedQuery(query.trim());
    } catch {
      setSearchError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Auto-load available courses on mount
  useEffect(() => {
    if (!organizationId) return;
    runSearch();
  }, [organizationId]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        subtitle="Course Catalog"
        title="Available Courses"
          breadcrumbs={
            <div className="flex items-center gap-2 text-sm">
              <Link href="/dashboard/student" className="text-primary-600 hover:text-primary-700">My Courses</Link>
              <span className="text-neutral-400">/</span>
              <span className="text-neutral-600">Available Courses</span>
            </div>
          }
        />

        <form onSubmit={runSearch} className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Search by title or description (optional)"
              placeholder="e.g. React, JavaScript, data science..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button type="submit" loading={loading} className="sm:w-auto">
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </form>

        {searchError ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState title="Unable to load courses" message={searchError} />
          </div>
        ) : results === null ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-12 shadow-sm">
            <div className="flex items-center justify-center gap-3 text-neutral-700">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-200 border-t-primary-600"></div>
              <span>Loading available courses...</span>
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <EmptyState
              icon={EmptyStateIcons.NoData}
              title="No courses available"
              description={submittedQuery ? `No courses matched "${submittedQuery}". Try a different keyword or clear the search.` : 'No published courses are currently available in your organization.'}
            />
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-neutral-600">
              {results.length} course{results.length !== 1 ? 's' : ''} available
              {submittedQuery && ` matching "${submittedQuery}"`}
            </p>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {results.map((course) => (
                <div key={course.id} className="rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all hover:border-primary-200 hover:shadow-md overflow-hidden">
                  {/* Thumbnail Image */}
                  {course.thumbnailUrl ? (
                    <div className="relative aspect-video w-full overflow-hidden bg-neutral-100">
                      <img
                        src={course.thumbnailUrl}
                        alt={course.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="relative aspect-video w-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                      <svg className="h-16 w-16 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                  )}
                  
                  <div className="p-6">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {course.category && <Badge variant="primary" size="sm">{course.category}</Badge>}
                      {course.difficulty && <Badge variant="default" size="sm">{course.difficulty}</Badge>}
                      {course.isEnrolled && <Badge variant="success" size="sm">Enrolled</Badge>}
                    </div>
                    <h3 className="text-lg font-semibold text-neutral-900 line-clamp-2">{course.title}</h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      {course.instructor?.name ? `Instructor: ${course.instructor.name}` : 'Self-paced'}
                    </p>
                    {course.description && (
                      <p className="mt-2 text-sm text-neutral-600 line-clamp-2">{course.description}</p>
                    )}
                    <div className="mt-4 flex items-center justify-between text-sm text-neutral-500">
                      <span>
                        {course.estimatedMinutes
                          ? `${Math.round(course.estimatedMinutes / 60)}h ${course.estimatedMinutes % 60}m`
                          : 'Self-paced'}
                      </span>
                      <span className="font-semibold text-neutral-900">{formatPrice(course.price)}</span>
                    </div>
                    <div className="mt-4">
                      {course.isEnrolled ? (
                        <Button
                          variant="primary"
                          size="sm"
                          fullWidth
                          loading={navigatingCourseId === course.id}
                          onClick={() => {
                            setNavigatingCourseId(course.id);
                            router.push(`/dashboard/student/courses/${course.id}`);
                          }}
                        >
                          Continue Learning
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          fullWidth
                          loading={navigatingCourseId === course.id}
                          onClick={() => {
                            setNavigatingCourseId(course.id);
                            router.push(`/dashboard/student/courses/${course.id}/overview`);
                          }}
                        >
                          View & Enroll
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
  );
}
