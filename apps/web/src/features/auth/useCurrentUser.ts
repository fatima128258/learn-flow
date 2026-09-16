'use client';

import { useQuery } from '@tanstack/react-query';
import { ApiError, apiRequest, logout } from '../../lib/api';
import type { CurrentUser, MeResponse } from '../../lib/types';

export const meKey = ['auth', 'me'] as const;
const AUTH_USER_CACHE_KEY = 'learnflow:last-authenticated-user';

function readCachedUser(): CurrentUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(AUTH_USER_CACHE_KEY);
    return value ? JSON.parse(value) as CurrentUser : null;
  } catch {
    return null;
  }
}

function cacheUser(user: CurrentUser | null) {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      window.sessionStorage.setItem(AUTH_USER_CACHE_KEY, JSON.stringify(user));
    } else {
      window.sessionStorage.removeItem(AUTH_USER_CACHE_KEY);
    }
  } catch {
    // Session storage is an optimization; authentication remains server-authoritative.
  }
}

export function useCurrentUser() {
  return useQuery({
    queryKey: meKey,
    queryFn: async ({ signal }) => {
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), 10_000);
      const abortRequest = () => timeoutController.abort();
      signal.addEventListener('abort', abortRequest, { once: true });
      try {
        const body = await apiRequest<MeResponse>('/api/v1/auth/me', {
          signal: timeoutController.signal,
        });
        const user = body.user ?? null;
        cacheUser(user);
        return user;
      } catch (error) {
        if (error instanceof ApiError && (error.status === 0 || error.status === 429 || error.status >= 500)) {
          const cachedUser = readCachedUser();
          if (cachedUser) return cachedUser;
        }
        if (error instanceof ApiError && error.status === 401) {
          cacheUser(null);
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
        signal.removeEventListener('abort', abortRequest);
      }
    },
    // OPTIMIZATION: Configure caching to reduce duplicate /auth/me calls
    // staleTime: data is fresh for 5 minutes, won't trigger re-fetch on re-mount/re-renders
    // gcTime: keep data in cache for 10 minutes after last subscriber leaves
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes (formerly cacheTime)
    retry: (failureCount, error) => {
      if (!(error instanceof ApiError)) return false;
      return (error.status === 0 || error.status >= 500) && failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 4000),
  });
}

export type { CurrentUser };

export function isStudent(user: CurrentUser | null | undefined): boolean {
  return user?.role === 'STUDENT';
}

export function logoutAndRedirect(): void {
  void logout();
}
