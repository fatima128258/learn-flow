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
}: {
  organizationId: string | null;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

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
    </label>
  );
}
