/**
 * TanStack Query client factory for the web app (server data cache for admin and seller pages).
 */
import { QueryClient } from '@tanstack/react-query';

/**
 * Create a query client with sensible defaults: no retries for 4xx errors, short stale time.
 * @returns {QueryClient}
 */
export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error?.status && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
