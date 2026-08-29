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
  });
}

export type { CurrentUser };

export function isStudent(user: CurrentUser | null | undefined): boolean {
  return user?.role === 'STUDENT';
}

export function logoutAndRedirect(): void {
  void logout();
}