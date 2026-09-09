'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Badge, Card, EmptyState, EmptyStateIcons, ErrorState, Skeleton } from '@/components/ui';
import { PageHeader } from '@/components/dashboard';
import { LinkButton } from '@/components/ui/LinkButton';
import { ApiError, apiRequest } from '@/lib/api';

type Category = {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  courseCount: number;
};

type Course = {
  id: string;
  title: string;
  status: string;
  price: number | string | null;
  discountPrice: number | string | null;
  instructor?: { id: string; name: string | null };
  createdAt: string;
};

export default function CategoryDetailsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const categoryId = typeof params.categoryId === 'string' ? params.categoryId : null;
  const organizationId = searchParams.get('organization');
  const headers = organizationId ? { 'X-Organization-Id': organizationId } : undefined;
  const [category, setCategory] = useState<Category | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function load() {
    if (!categoryId) return;
    setLoading(true);
    setError(false);
    try {
      const [categoryResponse, coursesResponse] = await Promise.all([
        apiRequest<{ data?: Category }>(`/api/v1/org/categories/${categoryId}`, { headers }),
        apiRequest<{ data?: Course[] }>(
          `/api/v1/organizations/${organizationId ?? ''}/courses?categoryId=${encodeURIComponent(categoryId)}&limit=100`,
          { headers },
        ),
      ]);
      setCategory(categoryResponse.data ?? null);
      setCourses(coursesResponse.data ?? []);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'CATEGORY_NOT_FOUND') {
        setCategory(null);
      }
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [categoryId, organizationId]);

  if (loading) {
    return <div className="mx-auto max-w-6xl space-y-4"><Skeleton variant="text" height={36} /><Skeleton variant="rectangular" height={220} /></div>;
  }
  if (error || !category) {
    return <div className="mx-auto max-w-6xl"><ErrorState title="Unable to load category" action={{ label: 'Try again', onClick: () => void load() }} /></div>;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={category.name}
        description={category.description || 'No description provided.'}
        actions={<LinkButton href={`/dashboard/organization/categories${organizationId ? `?organization=${encodeURIComponent(organizationId)}` : ''}`} variant="ghost">← Back to Categories</LinkButton>}
      />
      <div className="mb-6 flex items-center gap-3"><Badge variant={category.status === 'ACTIVE' ? 'success' : 'default'} size="sm">{category.status}</Badge><span className="text-sm text-neutral-500">{category.courseCount} courses</span></div>
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Courses in this Category</h2>
        {courses.length === 0 ? (
          <EmptyState icon={EmptyStateIcons.NoData} title="No courses assigned" description="No courses are assigned to this category yet." />
        ) : (
          <div className="overflow-x-auto"><table className="min-w-full divide-y divide-neutral-200"><thead><tr className="text-left text-xs font-semibold uppercase tracking-wide text-neutral-500"><th className="px-4 py-3">Course</th><th className="px-4 py-3">Instructor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-neutral-100">{courses.map((course) => <tr key={course.id} className="text-sm"><td className="px-4 py-4 font-medium text-neutral-900">{course.title}</td><td className="px-4 py-4 text-neutral-600">{course.instructor?.name || 'Unassigned'}</td><td className="px-4 py-4"><Badge variant={course.status === 'PUBLISHED' ? 'success' : 'default'} size="sm">{course.status}</Badge></td><td className="px-4 py-4 text-neutral-600">{new Date(course.createdAt).toLocaleDateString()}</td><td className="px-4 py-4 text-neutral-600">{course.price == null ? 'Free' : `$${course.discountPrice ?? course.price}`}</td><td className="px-4 py-4"><LinkButton href={`/dashboard/organization/courses/${course.id}`} size="sm" variant="ghost">View</LinkButton></td></tr>)}</tbody></table></div>
        )}
      </Card>
    </div>
  );
}
