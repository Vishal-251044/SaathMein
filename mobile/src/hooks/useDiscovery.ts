/**
 * useDiscovery — home feed, filtered group browsing (infinite list), wallet and referral.
 */
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import * as discoveryService from '@/services/discovery.service';
import type { GroupFilters } from '@/types/feed';

const FEED_STALE_MS = 60_000;

/** @param enabled - Logged in and onboarded @returns Home feed query */
export function useHomeFeed(enabled = true) {
  return useQuery({
    queryKey: ['feed', 'home'],
    queryFn: () => discoveryService.getHomeFeed(),
    enabled,
    staleTime: FEED_STALE_MS,
  });
}

/** @param filters - Current filters @returns Infinite list of group pages */
export function useBrowseGroups(filters: GroupFilters) {
  return useInfiniteQuery({
    queryKey: ['groups', 'browse', filters],
    queryFn: ({ pageParam }) => discoveryService.browseGroups(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.hasNextPage ? last.meta.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}

/** @returns Wallet balance and first page of history */
export function useWallet() {
  return useQuery({ queryKey: ['wallet'], queryFn: () => discoveryService.getWallet(1) });
}

/** @returns My referral card */
export function useReferral() {
  return useQuery({ queryKey: ['referral'], queryFn: discoveryService.getReferral });
}

/** @returns Mutation `code` that adds a friend's referral code */
export function useApplyReferral() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: discoveryService.applyReferral,
    onSuccess: (referral) => queryClient.setQueryData(['referral'], referral),
  });
}
