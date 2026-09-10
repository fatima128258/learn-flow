'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge, Button, Card, ConfirmModal, Drawer, EmptyState, EmptyStateIcons, ErrorState, Input, Modal, Skeleton, useToast } from '@/components/ui';
import { ApiError, apiRequest } from '@/lib/api';

type Category = {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  courseCount: number;
  instructors: Array<{ id: string; name: string }>;
  createdAt: string;
};
type ListResponse = { data?: Category[]; meta?: { page: number; limit: number; total: number; totalPages: number } };

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'CATEGORY_NAME_TAKEN') return 'A category with this name already exists.';
    if (error.code === 'CATEGORY_IN_USE') return 'This category is assigned to one or more courses and cannot be deleted.';
    if (error.code === 'MISSING_FIELDS') return 'Enter a valid category name and description.';
  }
  return 'Something went wrong. Please try again.';
}

export default function CategoriesPage() {
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organization');
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<ListResponse['meta']>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<Category | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setLoading(true);
    setError(false);
    try {
      const query = new URLSearchParams({ page: String(page), limit: '20' });
      if (search.trim()) query.set('search', search.trim());
      const result = await apiRequest<ListResponse>(`/api/v1/org/categories?${query}`, {
        headers: organizationId ? { 'X-Organization-Id': organizationId } : undefined,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setCategories(result.data ?? []);
        setMeta(result.meta);
      }
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [page, search, organizationId]);

  useEffect(() => {
    void load();
    return () => requestControllerRef.current?.abort();
  }, [load]);

  const hasCategories = categories.length > 0;
  const emptyAction = useMemo(() => ({ label: 'Create category', onClick: () => setEditing(null) }), []);

  async function removeCategory() {
    if (!deleting) return;
    try {
      await apiRequest(`/api/v1/org/categories/${deleting.id}`, {
        method: 'DELETE',
        headers: organizationId ? { 'X-Organization-Id': organizationId } : undefined,
      });
      toast.success('Category deleted successfully.');
      setDeleting(null); void load();
    } catch (err) { toast.error(errorMessage(err)); }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          variant="line"
          placeholder="Search by category name"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          className="max-w-md"
        />
        <Button onClick={() => setEditing(null)} className="whitespace-nowrap">Add category</Button>
      </div>
      <Card>
        {loading ? <div className="space-y-4"><Skeleton variant="text" height={28} /><Skeleton variant="text" height={28} /><Skeleton variant="text" height={28} /></div>
          : error ? <ErrorState title="Unable to load categories" action={{ label: 'Try again', onClick: () => void load() }} />
          : !hasCategories ? <EmptyState icon={search ? EmptyStateIcons.NoResults : EmptyStateIcons.NoData} title={search ? 'No matching categories' : 'No categories yet'} description={search ? 'Try a different search.' : 'Create your first category to organize courses.'} action={!search ? emptyAction : undefined} />
          : <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead><tr className="text-left text-xs font-semibold uppercase tracking-wide text-neutral-500"><th className="px-4 py-3">Category Name</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Courses</th><th className="px-4 py-3">Instructors</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead>
                <tbody className="divide-y divide-neutral-100">{categories.map((category) => <tr key={category.id} className="cursor-pointer text-sm hover:bg-neutral-50" onClick={() => setSelectedCategory(category)}><td className="px-4 py-4 font-medium text-neutral-900">{category.name}</td><td className="max-w-xs px-4 py-4 text-neutral-600"><span className="line-clamp-2">{category.description || '—'}</span></td><td className="px-4 py-4 text-neutral-600">{category.courseCount}</td><td className="max-w-xs px-4 py-4 text-neutral-600"><span className="line-clamp-2">{category.instructors?.length ? category.instructors.map((instructor) => instructor.name).join(', ') : '—'}</span></td><td className="px-4 py-4"><Badge variant={category.status === 'ACTIVE' ? 'success' : 'default'} size="sm">{category.status}</Badge></td><td className="px-4 py-4" onClick={(event) => event.stopPropagation()}><CategoryActionsMenu onView={() => setSelectedCategory(category)} onEdit={() => setEditing(category)} onDelete={() => setDeleting(category)} /></td></tr>)}</tbody>
              </table>
            </div>}
        {meta && meta.totalPages > 1 && <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-4 text-sm text-neutral-600"><span>Page {meta.page} of {meta.totalPages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>}
      </Card>
      <CategoryModal
        key={editing ? editing.id : 'new-category'}
        category={editing}
        organizationId={organizationId}
        onClose={() => setEditing(undefined)}
        onSaved={() => { setEditing(undefined); void load(); }}
      />
      <Drawer isOpen={!!selectedCategory} onClose={() => setSelectedCategory(null)} title={selectedCategory?.name}>
        {selectedCategory ? (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Category status</p>
              <div className="mt-2"><Badge variant={selectedCategory.status === 'ACTIVE' ? 'success' : 'default'} size="sm">{selectedCategory.status}</Badge></div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Description</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-neutral-700">{selectedCategory.description || 'No description provided.'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-neutral-50 p-4"><p className="text-xs text-neutral-500">Courses</p><p className="mt-1 text-2xl font-semibold text-neutral-900">{selectedCategory.courseCount}</p></div>
              <div className="rounded-lg bg-neutral-50 p-4"><p className="text-xs text-neutral-500">Instructors</p><p className="mt-1 text-2xl font-semibold text-neutral-900">{selectedCategory.instructors?.length ?? 0}</p></div>
            </div>
            <div className="flex gap-2 border-t border-neutral-200 pt-5">
              <Button size="sm" onClick={() => { setEditing(selectedCategory); setSelectedCategory(null); }}>Edit category</Button>
              <Button size="sm" variant="danger" onClick={() => { setDeleting(selectedCategory); setSelectedCategory(null); }}>Delete</Button>
            </div>
          </div>
        ) : null}
      </Drawer>
      <ConfirmModal isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => void removeCategory()} title="Delete category" message={`Delete "${deleting?.name}"? Categories assigned to courses cannot be deleted.`} variant="danger" />
    </div>
  );
}

function CategoryActionsMenu({ onView, onEdit, onDelete }: { onView: () => void; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex justify-end">
      <button type="button" aria-label="Category actions" className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800" onClick={() => setOpen((value) => !value)}>
        <span className="sr-only">Category actions</span>
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
      </button>
      {open ? (
        <div className="absolute bottom-10 right-0 z-20 w-36 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
          <button type="button" className="block w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50" onClick={() => { setOpen(false); onView(); }}>View details</button>
          <button type="button" className="block w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50" onClick={() => { setOpen(false); onEdit(); }}>Edit</button>
          <button type="button" className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50" onClick={() => { setOpen(false); onDelete(); }}>Delete</button>
        </div>
      ) : null}
    </div>
  );
}

function CategoryModal({ category, organizationId, onClose, onSaved }: { category: Category | null | undefined; organizationId: string | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>(category?.status ?? 'ACTIVE');
  const [saving, setSaving] = useState(false);
  if (category === undefined) return null;
  async function save() {
    setSaving(true);
    try {
      const body = { name, description, status };
      const headers = organizationId ? { 'X-Organization-Id': organizationId } : undefined;
      if (category) await apiRequest(`/api/v1/org/categories/${category.id}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
      else await apiRequest('/api/v1/org/categories', { method: 'POST', headers, body: JSON.stringify(body) });
      toast.success(category ? 'Category updated successfully.' : 'Category created successfully.'); onSaved();
    } catch (err) { toast.error(errorMessage(err)); } finally { setSaving(false); }
  }
  return <Modal isOpen onClose={onClose} title={category ? 'Edit category' : 'Create category'} footer={<><Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={() => void save()} loading={saving}>{category ? 'Save changes' : 'Create category'}</Button></>}><div className="space-y-4"><Input label="Name" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} required /><Input label="Description" value={description} maxLength={1000} onChange={(event) => setDescription(event.target.value)} /><label className="block text-sm font-medium text-neutral-700">Status<select className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2" value={status} onChange={(event) => setStatus(event.target.value as 'ACTIVE' | 'INACTIVE')}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label></div></Modal>;
}
