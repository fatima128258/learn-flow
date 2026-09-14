'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Drawer, EmptyState, EmptyStateIcons, ErrorState, Input, Modal, Skeleton, ViewToggle } from '@/components/ui';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { ApiError, apiRequest } from '@/lib/api';

type Category = { id: string; name: string; description: string | null; status?: 'ACTIVE' | 'INACTIVE'; ownerUserId?: string | null };

export default function InstructorCategoriesPage() {
  const router = useRouter();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const [privateName, setPrivateName] = useState('');
  const [privateDescription, setPrivateDescription] = useState('');
  const [privateStatus, setPrivateStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [showPrivateModal, setShowPrivateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
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

  async function savePrivateCategory() {
    const name = privateName.trim();
    if (!organizationId || !name || creating) return;

    setCreating(true);
    try {
      const result = await apiRequest<{ data?: Category }>(
        editingCategory
          ? `/api/v1/organizations/${organizationId}/categories/${editingCategory.id}`
          : `/api/v1/organizations/${organizationId}/categories`,
        { method: editingCategory ? 'PATCH' : 'POST', body: JSON.stringify({ name, description: privateDescription.trim(), status: privateStatus }) },
      );
      if (result.data) {
        setCategories((current) => (editingCategory
          ? current.map((category) => category.id === result.data!.id ? result.data! : category)
          : [...current, result.data!]).sort((a, b) => a.name.localeCompare(b.name)));
      }
      setPrivateName('');
      setPrivateDescription('');
      setPrivateStatus('ACTIVE');
      setShowPrivateModal(false);
      setEditingCategory(null);
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
  const visibleCategories = categories.filter((category) => {
    const query = search.trim().toLowerCase();
    return !query || category.name.toLowerCase().includes(query) || (category.description ?? '').toLowerCase().includes(query);
  });

  return (
    <div className="mx-auto max-w-6xl">
      {!loading && !failed && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input variant="line" className="max-w-md" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search categories" aria-label="Search categories" />
          <div className="flex items-center gap-2">
            <Button type="button" className="min-w-[140px] whitespace-nowrap" onClick={() => { setEditingCategory(null); setPrivateName(''); setPrivateDescription(''); setPrivateStatus('ACTIVE'); setShowPrivateModal(true); }}>Add private</Button>
            <ViewToggle value={viewMode} onChange={setViewMode} storageKey="learnhub-instructor-categories-view" />
          </div>
        </div>
      )}
      {loading ? <div className="space-y-4"><Skeleton variant="text" height={30} /><Skeleton variant="text" height={30} /></div>
        : failed ? <ErrorState title={organizationId ? 'Unable to load categories' : 'No organization assigned'} message={organizationId ? errorMessage : 'Categories are available only through your organization.'} />
          : visibleCategories.length === 0 ? <EmptyState icon={search ? EmptyStateIcons.NoResults : EmptyStateIcons.NoData} title={search ? 'No matching categories' : 'No categories available'} description={search ? 'Try a different search.' : 'Create a private category above or ask your Organization Admin to create an organization category.'} />
          : viewMode === 'table' ? (
            <div className="overflow-x-auto rounded-2xl border border-[#ead8c6] bg-[#fffdf9] shadow-sm">
              <table className="min-w-full divide-y divide-[#f0e2d3]">
                <thead className="bg-[#f8f2eb]"><tr className="text-left text-xs font-semibold uppercase tracking-wide text-[#5f6368]"><th className="px-5 py-3">Category</th><th className="px-5 py-3">Description</th><th className="px-5 py-3">Owner</th><th className="px-5 py-3 text-center">Status</th></tr></thead>
                <tbody className="divide-y divide-[#f0e2d3]">{visibleCategories.map((category) => <tr key={category.id} className="text-sm transition-colors hover:bg-[#fff9f0]"><td className="px-5 py-4 font-semibold text-[#17212b]">{category.name}</td><td className="max-w-md px-5 py-4 text-[#5f6368]"><span className="block truncate">{category.description || 'No description provided.'}</span></td><td className="px-5 py-4 text-[#5f6368]">{category.ownerUserId ? 'Private' : 'Organization'}</td><td className="px-5 py-4 text-center"><Badge variant={category.status === 'ACTIVE' ? 'success' : 'default'} size="sm">{category.status ?? 'ACTIVE'}</Badge></td></tr>)}</tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCategories.map((category) => (
                <article
                  key={category.id}
                  className="flex min-h-44 flex-col rounded-2xl border border-[#ead8c6] bg-[#fffdf9] p-5 shadow-sm transition-shadow duration-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="min-w-0 truncate text-lg font-semibold text-[#17212b]">
                      {category.name}
                    </h2>
                    <span className="shrink-0 rounded-full bg-[#f5ebdd] px-2.5 py-1 text-xs font-medium text-[#7a4a2e]">
                      {category.ownerUserId ? 'Private' : 'Organization'}
                    </span>
                  </div>
                  <p className="mt-4 line-clamp-3 flex-1 text-sm leading-6 text-[#5f6368]">
                    {category.description || 'No description provided.'}
                  </p>
                  <div className="mt-5 border-t border-[#ead8c6] pt-3 text-xs font-medium uppercase tracking-wide text-[#9b765c]">
                    {category.status === 'INACTIVE' ? 'Inactive' : 'Active'}
                  </div>
                </article>
              ))}
            </div>
          )}
      <Modal
        isOpen={showPrivateModal}
        onClose={() => { if (!creating) setShowPrivateModal(false); }}
        title={editingCategory ? 'Edit private category' : 'Add private category'}
        footer={<><Button variant="ghost" onClick={() => setShowPrivateModal(false)} disabled={creating}>Cancel</Button><Button onClick={() => void savePrivateCategory()} loading={creating} disabled={!privateName.trim()}>{editingCategory ? 'Save changes' : 'Create category'}</Button></>}
      >
        <div className="space-y-4">
          <Input label="Category name" value={privateName} onChange={(event) => setPrivateName(event.target.value)} maxLength={100} required disabled={creating} />
          <Input label="Description" value={privateDescription} onChange={(event) => setPrivateDescription(event.target.value)} maxLength={1000} disabled={creating} />
          <label className="block text-sm font-medium text-neutral-700">
            Status
            <select className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2" value={privateStatus} onChange={(event) => setPrivateStatus(event.target.value as 'ACTIVE' | 'INACTIVE')} disabled={creating}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
        </div>
      </Modal>
      <Drawer isOpen={Boolean(selectedCategory)} onClose={() => setSelectedCategory(null)} title={selectedCategory?.name ?? 'Category details'}>
        {selectedCategory && <div className="space-y-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Status</p><p className="mt-2 text-sm text-neutral-700">{selectedCategory.status ?? 'ACTIVE'}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Description</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{selectedCategory.description || 'No description provided.'}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Category name</p><p className="mt-2 text-sm text-neutral-700">{selectedCategory.name}</p></div></div>}
      </Drawer>
    </div>
  );
}
