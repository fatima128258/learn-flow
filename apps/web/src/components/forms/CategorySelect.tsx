'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

type CategoryOption = {
  id: string;
  name: string;
};

export function CategorySelect({
  organizationId,
  value,
  onChange,
  disabled = false,
  allowPrivateCreate = false,
}: {
  organizationId: string | null;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  allowPrivateCreate?: boolean;
}) {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [privateName, setPrivateName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    setLoading(true);
    setFailed(false);
    apiRequest<{ data?: CategoryOption[] }>(
      `/api/v1/organizations/${organizationId}/categories`,
    )
      .then((result) => {
        if (active) setCategories(result.data ?? []);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organizationId]);

  async function createPrivateCategory() {
    const name = privateName.trim();
    if (!organizationId || !name || creating) return;
    setCreating(true);
    try {
      const result = await apiRequest<{ data?: CategoryOption }>(`/api/v1/organizations/${organizationId}/categories`, {
        method: 'POST', body: JSON.stringify({ name }),
      });
      if (result.data) {
        setCategories((current) => [...current, result.data!].sort((a, b) => a.name.localeCompare(b.name)));
        onChange(result.data.id);
        setPrivateName('');
      }
    } finally { setCreating(false); }
  }

  return (
    <label className="block text-sm font-medium text-neutral-700">
      Category
      <select
        className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || loading || failed}
      >
        <option value="">
          {loading ? 'Loading categories...' : failed ? 'Unable to load categories' : categories.length ? 'No category' : 'No categories available'}
        </option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      {!loading && !failed && categories.length === 0 && (
        <span className="mt-1 block text-xs text-neutral-500">Create an active category before assigning it to a course.</span>
      )}
      {allowPrivateCreate && (
        <div className="mt-2 flex gap-2">
          <input className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm" value={privateName} onChange={(event) => setPrivateName(event.target.value)} placeholder="New private category" maxLength={100} disabled={disabled || creating} />
          <button type="button" className="rounded-md border border-primary-600 px-3 py-2 text-sm font-medium text-primary-700 disabled:opacity-50" onClick={() => void createPrivateCategory()} disabled={disabled || creating || !privateName.trim()}>{creating ? 'Creating...' : 'Add private'}</button>
        </div>
      )}
    </label>
  );
}
