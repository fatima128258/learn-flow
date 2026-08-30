'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  EmptyState,
  EmptyStateIcons,
  ErrorState,
  Input,
  LinkButton,
} from '@/components/ui';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { studentNav } from '@/features/student/nav';
import { PageHeader } from '@/components/dashboard';

type MeResponse = {
  user?: {
    id?: string;
    name?: string | null;
    email?: string;
    role?: string | null;
    organizationId?: string | null;
  };
};

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
};

function formatPrice(value: number | null) {
  if (value === null || value === undefined) return 'Free';
  if (value === 0) return 'Free';
  return `$${Number(value).toFixed(2)}`;
}

export default function StudentSearchPage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [results, setResults] = useState<CourseHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

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
        setOrganizationId(orgId);
      } catch {
        if (active) window.location.href = '/login';
      }
    }

    guard();
    return () => {
      active = false;
    };
  }, []);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!organizationId) return;

    setLoading(true);
    setSearchError(null);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
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

  return (
    <DashboardLayout navLabel="Student" items={studentNav}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          subtitle="Course Catalog"
          title="Search Courses"
          breadcrumbs={
            <div className="flex items-center gap-2 text-sm">
              <Link href="/dashboard/student" className="text-primary-600 hover:text-primary-700">My Courses</Link>
              <span className="text-neutral-400">/</span>
              <span className="text-neutral-600">Search Courses</span>
            </div>
          }
        />

        <form onSubmit={runSearch} className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Search by title or description"
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
            <ErrorState title="Unable to search" message={searchError} />
          </div>
        ) : results === null ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <EmptyState
              icon={EmptyStateIcons.NoData}
              title="Search the catalog"
              description="Enter a keyword to find published courses. Only courses available in your organization are shown."
            />
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <EmptyState
              icon={EmptyStateIcons.NoData}
              title="No courses found"
              description={submittedQuery ? `Nothing matched "${submittedQuery}". Try a different keyword.` : 'No published courses matched your search.'}
            />
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-neutral-600">
              {results.length} course{results.length !== 1 ? 's' : ''} found
            </p>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {results.map((course) => (
                <div key={course.id} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-all hover:border-primary-200 hover:shadow-md">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {course.category && <Badge variant="primary" size="sm">{course.category}</Badge>}
                    {course.difficulty && <Badge variant="default" size="sm">{course.difficulty}</Badge>}
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
                    <LinkButton href={`/courses/${course.id}`} variant="primary" size="sm" fullWidth>
                      View & Enroll
                    </LinkButton>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
