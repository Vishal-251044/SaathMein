/**
 * Shared TanStack Query client: server data (groups, products, offers) lives in the
 * query cache; only client/UI state goes in Zustand stores.
 */
import { QueryClient } from '@tanstack/react-query';

import { ApiClientError } from '@/services/api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      // Retry network blips twice, but never retry 4xx errors (they will fail again)
      retry: (failureCount, error) => {
        if (error instanceof ApiClientError && error.status && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});
