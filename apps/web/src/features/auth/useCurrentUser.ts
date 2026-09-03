'use client';

import { useQuery } from '@tanstack/react-query';
import { getJson, logout } from '../../lib/api';
import type { CurrentUser, MeResponse } from '../../lib/types';

export const meKey = ['auth', 'me'] as const;

export function useCurrentUser() {
  return useQuery({
    queryKey: meKey,
    queryFn: async () => {
      const body = await getJson<MeResponse>('/api/v1/auth/me');
      return body.user ?? null;
    },
    // OPTIMIZATION: Configure caching to reduce duplicate /auth/me calls
    // staleTime: data is fresh for 5 minutes, won't trigger re-fetch on re-mount/re-renders
    // gcTime: keep data in cache for 10 minutes after last subscriber leaves
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes (formerly cacheTime)
  });
}

export type { CurrentUser };

export function isStudent(user: CurrentUser | null | undefined): boolean {
  return user?.role === 'STUDENT';
}

export function logoutAndRedirect(): void {
  void logout();
}
