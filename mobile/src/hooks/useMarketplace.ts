/**
 * Marketplace hooks (TanStack Query): verified dealers in the buyer's city and product
 * requests.
 */
import { useMutation, useQuery } from '@tanstack/react-query';

import { listVerifiedSellers, requestProduct } from '@/services/marketplace.service';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Verified dealers in the logged-in user's city.
 * @param categoryId - Only dealers selling this category (optional)
 * @returns Query with dealer cards (disabled until the user has a city)
 */
export function useVerifiedSellers(categoryId?: string | null) {
  const cityId = useAuthStore((state) => state.user?.cityId ?? null);
  return useQuery({
    queryKey: ['sellers', { cityId, categoryId: categoryId ?? '' }],
    queryFn: () =>
      listVerifiedSellers({ cityId: cityId as string, categoryId: categoryId ?? undefined }),
    enabled: Boolean(cityId),
    staleTime: 5 * 60_000,
  });
}

/** @returns Mutation that sends a missing-product request */
export function useRequestProduct() {
  return useMutation({ mutationFn: requestProduct });
}
