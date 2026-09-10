'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button, Drawer, EmptyState, EmptyStateIcons, ErrorState, Input, Modal, Skeleton } from '@/components/ui';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { ApiError, apiRequest } from '@/lib/api';

type Category = { id: string; name: string; description: string | null; status?: 'ACTIVE' | 'INACTIVE'; ownerUserId?: string | null };

function PrivateCategoryActions({ onView, onEdit }: { onView: () => void; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, right: 8 });
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  function toggle(event: React.MouseEvent) {
    event.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
    }
    setOpen((value) => !value);
  }
  const menu = open ? <div className="fixed z-[60] w-32 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg" style={position} onMouseDown={(event) => event.stopPropagation()}>
    <button type="button" className="block w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50" onClick={() => { setOpen(false); onView(); }}>View</button>
    <button type="button" className="block w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50" onClick={() => { setOpen(false); onEdit(); }}>Edit</button>
  </div> : null;
  return <><button ref={buttonRef} type="button" aria-label="Category actions" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-lg font-bold leading-none text-neutral-700 hover:bg-neutral-100" onClick={toggle}><span aria-hidden="true">⋮</span></button>{typeof document !== 'undefined' && menu ? createPortal(menu, document.body) : null}</>;
}

export default function InstructorCategoriesPage() {
  const router = useRouter();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [search, setSearch] = useState('');
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

  function openEdit(category: Category) {
    setEditingCategory(category);
    setPrivateName(category.name);
    setPrivateDescription(category.description ?? '');
    setPrivateStatus(category.status ?? 'ACTIVE');
    setShowPrivateModal(true);
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
          <Button type="button" onClick={() => { setEditingCategory(null); setPrivateName(''); setPrivateDescription(''); setPrivateStatus('ACTIVE'); setShowPrivateModal(true); }}>Add private</Button>
        </div>
      )}
      {loading ? <div className="space-y-4"><Skeleton variant="text" height={30} /><Skeleton variant="text" height={30} /></div>
        : failed ? <ErrorState title={organizationId ? 'Unable to load categories' : 'No organization assigned'} message={organizationId ? errorMessage : 'Categories are available only through your organization.'} />
          : visibleCategories.length === 0 ? <EmptyState icon={search ? EmptyStateIcons.NoResults : EmptyStateIcons.NoData} title={search ? 'No matching categories' : 'No categories available'} description={search ? 'Try a different search.' : 'Create a private category above or ask your Organization Admin to create an organization category.'} />
          : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleCategories.map((category) => <article key={category.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-2"><h2 className="font-semibold text-neutral-900">{category.name}</h2><div className="flex items-center gap-2"><span className="text-xs text-neutral-500">{category.ownerUserId ? 'Private' : 'Organization'}</span>{category.ownerUserId && <PrivateCategoryActions onView={() => setSelectedCategory(category)} onEdit={() => openEdit(category)} />}</div></div><p className="mt-2 text-sm text-neutral-600">{category.description || 'No description provided.'}</p></article>)}</div>}
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
