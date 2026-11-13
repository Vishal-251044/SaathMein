/**
 * Shared TanStack Query client: server data (groups, products, offers) lives in the
 * query cache; only client/UI state goes in Zustand stores. Key screens are restored from
 * the offline cache on start and saved after each successful fetch (lib/queryPersist.ts);
 * fetching pauses while the API is unreachable (lib/connectivity.ts).
 */
import { QueryClient } from '@tanstack/react-query';

import '@/lib/connectivity';
import { restoreQueryCache, startPersistingQueries } from '@/lib/queryPersist';
import { ApiClientError } from '@/services/api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Never sit paused while offline: fail fast so screens show saved data (or the
      // offline state) and refetch by themselves when the connection returns
      networkMode: 'always',
      gcTime: 10 * 60_000,
      // Retry network blips twice, but never retry 4xx errors (they will fail again)
      retry: (failureCount, error) => {
        if (error instanceof ApiClientError && error.status && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    // A payment or join tapped offline must fail with a clear message, not hang
    mutations: { retry: false, networkMode: 'always' },
  },
});

// Offline: open with the last saved data, keep saving fresh data
restoreQueryCache(queryClient);
startPersistingQueries(queryClient);
