/**
 * Product hooks (TanStack Query): paginated lists/search and the product page.
 * Prices always come for the logged-in user's city.
 */
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';

import {
  getProduct,
  listPopularProducts,
  listProducts,
  registerProductInterest,
} from '@/services/catalog.service';
import { useAuthStore } from '@/stores/auth.store';

const PAGE_SIZE = 20;

/**
 * Infinite product list (category page, search results).
 * @param params - `q` (search text) and/or `categoryId`; `enabled` to pause the query
 * @returns Infinite query; flatten `data.pages[].products` to render
 */
export function useProductList({
  q,
  categoryId,
  enabled = true,
}: {
  q?: string;
  categoryId?: string;
  enabled?: boolean;
}) {
  const cityId = useAuthStore((state) => state.user?.cityId ?? null);
  return useInfiniteQuery({
    queryKey: ['products', { q: q ?? '', categoryId: categoryId ?? '', cityId }],
    queryFn: ({ pageParam }) =>
      listProducts({ q, categoryId, cityId, page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.page + 1 : undefined,
    enabled,
  });
}

/**
 * Product page data.
 * @param productId - Product id from the route
 * @returns Query with the product and city prices
 */
export function useProduct(productId: string | undefined) {
  const cityId = useAuthStore((state) => state.user?.cityId ?? null);
  return useQuery({
    queryKey: ['product', productId, cityId],
    queryFn: () => getProduct(productId as string, cityId),
    enabled: Boolean(productId),
  });
}

/** @returns Mutation that records "I want this" for a product */
export function useProductInterest() {
  return useMutation({ mutationFn: registerProductInterest });
}

/** @returns Query with the most wanted products in the user's city (Home rail) */
export function usePopularProducts() {
  const cityId = useAuthStore((state) => state.user?.cityId ?? null);
  return useQuery({
    queryKey: ['products', 'popular', cityId],
    queryFn: () => listPopularProducts(cityId),
    staleTime: 10 * 60_000,
  });
}
