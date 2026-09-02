'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Module-level reference to the active QueryClient.
 *
 * Exposed so that the logout helper can call clearQueryCache() before
 * redirecting to the login page, preventing authenticated data belonging to
 * the previous user from being visible to the next user who logs in on the
 * same browser tab.
 *
 * This is intentionally a module-level variable (not React state) so it can
 * be accessed synchronously from outside the component tree.
 */
let activeQueryClient: QueryClient | null = null;

/**
 * Clears all cached React Query data from the active QueryClient.
 * Call this during logout before redirecting away from the authenticated area.
 */
export function clearQueryCache(): void {
  activeQueryClient?.clear();
}

export const QueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          refetchOnWindowFocus: false,
          retry: false,
        },
      },
    });
    // Register this instance as the active client so clearQueryCache() works.
    activeQueryClient = client;
    return client;
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

QueryProvider.displayName = 'QueryProvider';
