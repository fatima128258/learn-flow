'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { Badge, Button, Drawer, EmptyState, EmptyStateIcons, ErrorState, Input, Modal, Select, Spinner, ViewToggle, useToast } from '@/components/ui';
import { Textarea } from '@/components/forms/Textarea';
import { ApiError, apiRequest } from '@/lib/api';
import { TableCard, tableActionClass, tableCellClass, tableHeadClass, tableRowHoverClass, tableStatusClass } from '@/components/dashboard';

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
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<ListResponse['meta']>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<Category | null | undefined>(undefined);
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
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        window.location.assign('/login');
        return;
      }
      setError(true);
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
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setEditing(null)}
            size="sm"
            className="h-10 min-w-[140px] whitespace-nowrap !border-0"
          >
            Add category
          </Button>
          <ViewToggle value={viewMode} onChange={setViewMode} storageKey="learnhub-organization-categories-view" />
        </div>
      </div>
      <TableCard>
        {loading ? <div className="flex items-center gap-3 p-5 text-neutral-700"><Spinner size="lg" label="Loading categories..." /><span>Loading categories...</span></div>
          : error ? <ErrorState title="Unable to load categories" action={{ label: 'Try again', onClick: () => void load() }} />
          : !hasCategories ? <EmptyState icon={search ? EmptyStateIcons.NoResults : EmptyStateIcons.NoData} title={search ? 'No matching categories' : 'No categories yet'} description={search ? 'Try a different search.' : 'Create your first category to organize courses.'} action={!search ? emptyAction : undefined} />
          : viewMode === 'cards' ? (
            <div className="grid gap-5 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <article key={category.id} className="flex min-h-52 flex-col rounded-2xl border border-[#ead8c6] bg-[#fff9f0] p-5 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 truncate text-lg font-semibold text-[#17212b]">{category.name}</h2>
                    <CategoryActionsMenu onView={() => setSelectedCategory(category)} onEdit={() => setEditing(category)} />
                  </div>
                  <div className="mt-3"><Badge variant={category.status === 'ACTIVE' ? 'success' : 'default'} size="sm">{category.status}</Badge></div>
                  <p className="mt-4 line-clamp-2 flex-1 text-sm leading-6 text-[#5f6368]">{category.description || 'No description provided.'}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#ead8c6] pt-4">
                    <div><p className="text-xs uppercase tracking-wide text-[#9b765c]">Courses</p><p className="mt-1 font-semibold text-[#17212b]">{category.courseCount}</p></div>
                    <div><p className="text-xs uppercase tracking-wide text-[#9b765c]">Instructors</p><p className="mt-1 truncate font-semibold text-[#17212b]">{category.instructors?.length ?? 0}</p></div>
                  </div>
                </article>
              ))}
            </div>
          )           : <div className="min-w-0">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50"><tr><th className={tableHeadClass}>Category Name</th><th className={tableHeadClass}>Description</th><th className={`${tableHeadClass} text-center`}>Courses</th><th className={tableHeadClass}>Instructors</th><th className={`${tableHeadClass} text-center`}>Status</th><th className={`${tableHeadClass} text-center`}>Actions</th></tr></thead>
                <tbody className="divide-y divide-neutral-200">{categories.map((category) => <tr key={category.id} className={`${tableRowHoverClass} cursor-pointer`} onClick={() => setSelectedCategory(category)}><td className={`${tableCellClass} font-medium text-neutral-900`}>{category.name}</td><td className={`${tableCellClass} max-w-xs text-neutral-700`}><span className="block max-w-xs truncate">{category.description || '—'}</span></td><td className={`${tableCellClass} text-center text-neutral-700`}>{category.courseCount}</td><td className={`${tableCellClass} max-w-xs text-neutral-700`}><span className="block line-clamp-2">{category.instructors?.length ? category.instructors.map((instructor) => instructor.name).join(', ') : '—'}</span></td><td className={tableStatusClass}><Badge variant={category.status === 'ACTIVE' ? 'success' : 'default'} size="sm">{category.status}</Badge></td><td className={tableActionClass} onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-center"><CategoryActionsMenu onView={() => setSelectedCategory(category)} onEdit={() => setEditing(category)} /></div></td></tr>)}</tbody>
              </table>
            </div>}
        {meta && meta.totalPages > 1 && <div className="mx-4 mt-0 flex items-center justify-between border-t border-neutral-200 px-1 py-4 text-sm text-neutral-600"><span>Page {meta.page} of {meta.totalPages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>}
      </TableCard>
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
            <div className="rounded-2xl border border-[#ead8c6] bg-[#fff9f0] p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-900">Category status</p>
              <div className="mt-3"><Badge variant={selectedCategory.status === 'ACTIVE' ? 'success' : 'default'} size="sm">{selectedCategory.status}</Badge></div>
            </div>
            <div className="rounded-2xl border border-[#ead8c6] bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-900">Description</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-neutral-900">{selectedCategory.description || 'No description provided.'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#ead8c6] bg-[#f8f2eb] p-4 shadow-sm"><p className="text-xs font-semibold text-neutral-900">Courses</p><p className="mt-2 text-2xl font-bold text-neutral-900">{selectedCategory.courseCount}</p></div>
              <div className="rounded-2xl border border-[#ead8c6] bg-[#f8f2eb] p-4 shadow-sm"><p className="text-xs font-semibold text-neutral-900">Instructors</p><p className="mt-2 text-2xl font-bold text-neutral-900">{selectedCategory.instructors?.length ?? 0}</p></div>
            </div>
            <div className="grid grid-cols-1 gap-3 border-t border-[#ead8c6] pt-5 sm:grid-cols-2">
              <Button size="sm" className="w-full" onClick={() => { setEditing(selectedCategory); setSelectedCategory(null); }}>Edit category</Button>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

function CategoryActionsMenu({ onView, onEdit }: { onView: () => void; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function closeOnViewportChange() {
      setOpen(false);
    }
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', closeOnViewportChange, true);
    window.addEventListener('resize', closeOnViewportChange);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', closeOnViewportChange, true);
      window.removeEventListener('resize', closeOnViewportChange);
    };
  }, [open]);

  function toggleMenu() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    setOpen(true);
  }

  return (
    <div className="flex justify-end">
      <button ref={buttonRef} type="button" aria-label="Category actions" className="inline-flex items-center justify-center rounded-lg border-0 p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 focus:border-0 focus:outline-none focus-visible:border-0 focus-visible:outline-none focus:ring-0 focus-visible:ring-0" onClick={toggleMenu}>
        <span className="sr-only">Category actions</span>
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
      </button>
      {open && typeof document !== 'undefined' ? createPortal(
        <div ref={menuRef} className="fixed z-[60] w-36 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg" style={{ top: position.top, right: position.right }}>
          <button type="button" className="block w-full border-0 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 focus:border-0 focus:outline-none focus-visible:border-0 focus-visible:outline-none focus:ring-0 focus-visible:ring-0" onClick={() => { setOpen(false); onView(); }}>View details</button>
          <button type="button" className="block w-full border-0 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 focus:border-0 focus:outline-none focus-visible:border-0 focus-visible:outline-none focus:ring-0 focus-visible:ring-0" onClick={() => { setOpen(false); onEdit(); }}>Edit</button>
        </div>,
        document.body,
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
  return <Modal isOpen onClose={onClose} title={category ? 'Edit category' : 'Create category'} footer={<><Button variant="ghost" onClick={onClose} disabled={saving} aria-label="Cancel"><span className="hidden sm:inline">Cancel</span><svg className="h-5 w-5 sm:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg></Button><Button onClick={() => void save()} loading={saving} aria-label={category ? 'Save changes' : 'Create category'}><span className="hidden sm:inline">{category ? 'Save changes' : 'Create category'}</span><svg className="h-5 w-5 sm:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" d="M5 12h14M12 5v14" /></svg></Button></>}><div className="space-y-4"><Input label="Name" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} required /><Textarea label="Description" value={description} maxLength={1000} rows={4} onChange={(event) => setDescription(event.target.value)} /><Select label="Status" value={status} onChange={(value) => setStatus(value as 'ACTIVE' | 'INACTIVE')} options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]} /></div></Modal>;
}
