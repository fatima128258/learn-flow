'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, EmptyState, EmptyStateIcons, ErrorState, Skeleton } from '@/components/ui';
import { PageHeader } from '@/components/dashboard';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { ApiError, apiRequest } from '@/lib/api';

type Category = { id: string; name: string; description: string | null; ownerUserId?: string | null };

export default function InstructorCategoriesPage() {
  const router = useRouter();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [privateName, setPrivateName] = useState('');
  const [creating, setCreating] = useState(false);
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
      setErrorCode(null);
      void (async () => {
        try {
          const result = await apiRequest<{ data?: Category[] }>(`/api/v1/organizations/${organizationId}/categories`);
          if (active) setCategories(result.data ?? []);
        } catch (error) {
          if (active) {
            setFailed(true);
            setErrorCode(error instanceof ApiError ? error.code : 'NETWORK_ERROR');
          }
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

  async function createPrivateCategory() {
    const name = privateName.trim();
    if (!organizationId || !name || creating) return;

    setCreating(true);
    try {
      const result = await apiRequest<{ data?: Category }>(
        `/api/v1/organizations/${organizationId}/categories`,
        { method: 'POST', body: JSON.stringify({ name }) },
      );
      if (result.data) {
        setCategories((current) => [...current, result.data!].sort((a, b) => a.name.localeCompare(b.name)));
        setPrivateName('');
      }
    } catch (error) {
      setErrorCode(error instanceof ApiError ? error.code : 'NETWORK_ERROR');
    } finally {
      setCreating(false);
    }
  }

  const errorMessage = errorCode === 'EMAIL_NOT_VERIFIED'
    ? 'Verify your email address before accessing instructor categories.'
    : errorCode === 'ORGANIZATION_ACCESS_DENIED'
      ? 'Your instructor account is not assigned to this organization.'
      : errorCode === 'SESSION_INVALID' || errorCode === 'NOT_AUTHENTICATED'
        ? 'Your session has expired. Please sign in again.'
        : 'The categories service could not be reached. Please try again.';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Categories"
        description="Use organization categories or create private categories for your own courses."
      />
      {!loading && !failed && (
        <div className="mb-5 flex max-w-xl gap-2">
          <input
            className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            value={privateName}
            onChange={(event) => setPrivateName(event.target.value)}
            placeholder="New private category"
            maxLength={100}
            disabled={creating}
          />
          <Button
            type="button"
            onClick={() => void createPrivateCategory()}
            disabled={creating || !privateName.trim()}
          >
            {creating ? 'Creating...' : 'Add private'}
          </Button>
        </div>
      )}
      {loading ? <div className="space-y-4"><Skeleton variant="text" height={30} /><Skeleton variant="text" height={30} /></div>
        : failed ? <ErrorState title={organizationId ? 'Unable to load categories' : 'No organization assigned'} message={organizationId ? errorMessage : 'Categories are available only through your organization.'} />
          : categories.length === 0 ? <EmptyState icon={EmptyStateIcons.NoData} title="No categories available" description="Create a private category above or ask your Organization Admin to create an organization category." />
          : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{categories.map((category) => <article key={category.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-2"><h2 className="font-semibold text-neutral-900">{category.name}</h2><span className="text-xs text-neutral-500">{category.ownerUserId ? 'Private' : 'Organization'}</span></div><p className="mt-2 text-sm text-neutral-600">{category.description || 'No description provided.'}</p></article>)}</div>}
    </div>
  );
}
