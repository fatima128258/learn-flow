'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Badge,
  EmptyState,
  EmptyStateIcons,
  ErrorState,
  Input,
  Spinner,
} from '@/components/ui';
import { useCurrentUser } from '@/features/auth/useCurrentUser';

type CourseHit = {
  id: string;
  organizationId: string;
  instructor?: { id: string; name: string | null } | null;
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
  hasPendingPayment: boolean;
  enrollmentCount: number;
};

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

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

  async function runSearch(e?: React.FormEvent, searchTerm = query) {
    if (e) e.preventDefault();
    if (!organizationId) return;

    const requestId = ++requestIdRef.current;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setSearchError(null);
    try {
      const apiBase = '';
      const params = new URLSearchParams();
      const normalizedTerm = searchTerm.trim();
      if (normalizedTerm) params.set('q', normalizedTerm);
      const qs = params.toString();

      const res = await fetch(
        `${apiBase}/api/v1/organizations/${organizationId}/student/search${qs ? `?${qs}` : ''}`,
        { credentials: 'include', signal: controller.signal },
      );
      if (requestId !== requestIdRef.current) return;
      if (!res.ok) {
        setSearchError('Could not search courses. Please try again.');
        return;
      }
      const body = await res.json();
      setResults(body.data ?? []);
      setSubmittedQuery(normalizedTerm);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (requestId !== requestIdRef.current) return;
      setSearchError('Could not reach the server. Please try again.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  // Auto-load available courses on mount
  useEffect(() => {
    if (!organizationId) return;
    runSearch();
  }, [organizationId]);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      requestRef.current?.abort();
    };
  }, []);

  // Handle search input with minimal debouncing for instant feel
  const handleSearchInput = (value: string) => {
    setQuery(value);
    setSubmittedQuery(value.trim());
    setSearchError(null);
    
    // Clear existing timeout
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    // Wait briefly for the user to finish typing, then cancel any stale request.
    debounceRef.current = setTimeout(() => {
      if (organizationId) {
        runSearch(undefined, value);
      }
    }, 250);
  };

  // Clear search and reset to all courses
  const handleClearSearch = () => {
    setQuery('');
    setSubmittedQuery('');
    setResults(null);
    setSearchError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (organizationId) {
      runSearch(undefined, '');
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 max-w-md">
        <div className="relative">
          <Input
            variant="line"
            placeholder="e.g. React, JavaScript, data science..."
            value={query}
            onChange={(e) => handleSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (debounceRef.current) clearTimeout(debounceRef.current);
                runSearch(undefined, query);
              }
            }}
          />
          {query && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
              aria-label="Clear search"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
      </div>

        {searchError ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState title="Unable to load courses" message={searchError} />
          </div>
        ) : results === null ? (
          <div className="flex min-h-64 items-center justify-center" role="status" aria-label="Loading available courses">
            <Spinner size="md" label="Loading..." />
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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {results.map((course) => (
                <div key={course.id} className="rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all hover:border-primary-200 hover:shadow-md overflow-hidden">
                  {/* Thumbnail Image */}
                  <div className="relative aspect-video w-full overflow-hidden bg-neutral-100">
                    {course.thumbnailUrl ? (
                      <img
                        src={course.thumbnailUrl}
                        alt={course.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary-100 to-primary-200">
                      <svg className="h-16 w-16 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                  )}
                    {course.hasPendingPayment && (
                      <Badge
                        variant="warning"
                        size="sm"
                        className="absolute left-4 top-4 bg-white text-[#b45309] shadow-sm"
                      >
                        Pending Approval
                      </Badge>
                    )}
                  </div>
                  
                  <div className="p-6">
                    <h3
                      className="truncate text-lg font-semibold text-neutral-900"
                      title={course.title}
                    >
                      {course.title}
                    </h3>
                    {course.instructor?.name && (
                      <p className="mt-1 text-sm text-neutral-500">
                        Instructor: {course.instructor.name}
                      </p>
                    )}
                    <div className="mt-4 flex items-center gap-4 text-sm text-neutral-500">
                      <span>{course.enrollmentCount.toLocaleString()} enrolled</span>
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
                      ) : course.hasPendingPayment ? (
                        <Button variant="secondary" size="sm" fullWidth disabled>
                          Pending Approval
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
                          Enroll
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
