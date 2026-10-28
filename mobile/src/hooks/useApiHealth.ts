/**
 * useApiHealth — TanStack Query hook for the backend health check.
 */
import { useQuery } from '@tanstack/react-query';

import { getHealth } from '@/services/health.service';

/**
 * @returns Query result with the backend health report
 */
export function useApiHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    retry: 1,
    staleTime: 30_000,
  });
}
