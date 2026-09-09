'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState, EmptyStateIcons, ErrorState, Skeleton } from '@/components/ui';
import { PageHeader } from '@/components/dashboard';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { apiRequest } from '@/lib/api';

type Category = { id: string; name: string; description: string | null };

export default function InstructorCategoriesPage() {
  const router = useRouter();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const organizationId = user?.organizationId;

  useEffect(() => {
    if (userLoading) return;
    if (!user || user.role !== 'INSTRUCTOR') {
      router.push(!user ? '/login' : '/dashboard');
      return;
    }
  }, [router, user, userLoading]);

  useEffect(() => {
    if (userLoading || !user || user.role !== 'INSTRUCTOR' || !organizationId) {
      if (!userLoading && (!user || user.role !== 'INSTRUCTOR')) return;
      if (!organizationId) {
        const timer = window.setTimeout(() => {
          setLoading(false);
          setFailed(true);
        }, 0);
        return () => window.clearTimeout(timer);
      }
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setLoading(true);
      setFailed(false);
      void (async () => {
        try {
          const result = await apiRequest<{ data?: Category[] }>(`/api/v1/organizations/${organizationId}/categories`);
          if (active) setCategories(result.data ?? []);
        } catch {
          if (active) setFailed(true);
        } finally {
          if (active) setLoading(false);
        }
      })();
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [organizationId, user, userLoading]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Categories" description="Categories are managed by your Organization Admin." />
      {loading ? <div className="space-y-4"><Skeleton variant="text" height={30} /><Skeleton variant="text" height={30} /></div>
        : failed ? <ErrorState title={organizationId ? 'Unable to load categories' : 'No organization assigned'} message="Categories are available only through your organization." />
          : categories.length === 0 ? <EmptyState icon={EmptyStateIcons.NoData} title="No categories available" description="Categories are managed by your Organization Admin." />
            : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{categories.map((category) => <article key={category.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-neutral-900">{category.name}</h2><p className="mt-2 text-sm text-neutral-600">{category.description || 'No description provided.'}</p></article>)}</div>}
    </div>
  );
}
