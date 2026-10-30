/**
 * Group hooks (TanStack Query): lists, similar groups, the group page, My Groups and the
 * leader's actions. Mutations put the returned group in the cache and refresh lists.
 * Live updates over Socket.io (with polling fallback) arrive on Day 8; until then the
 * group page refetches every 30 s while open.
 */
import {
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import * as groupService from '@/services/group.service';
import { useAuthStore } from '@/stores/auth.store';
import type { GroupDetail } from '@/types/group';

const GROUP_REFRESH_MS = 30_000;

/** Put a group in the cache and mark every list stale. */
function cacheGroup(queryClient: QueryClient, group: GroupDetail) {
  queryClient.setQueryData(['group', group.id], group);
  queryClient.invalidateQueries({ queryKey: ['groups'] });
}

/** @param productId - Product page @returns Open groups for this product in my city */
export function useProductGroups(productId: string | undefined) {
  const cityId = useAuthStore((state) => state.user?.cityId ?? null);
  return useQuery({
    queryKey: ['groups', 'product', productId, cityId],
    queryFn: () => groupService.listGroups({ productId, sort: 'filling', limit: 5 }),
    enabled: Boolean(productId),
  });
}

/** @returns Similar open groups for the create flow (GRP-2) */
export function useSimilarGroups(productId: string | undefined, variantKey: string | null) {
  return useQuery({
    queryKey: ['groups', 'similar', productId, variantKey],
    queryFn: () => groupService.getSimilarGroups(productId as string, variantKey),
    enabled: Boolean(productId),
  });
}

/** @param role - "joined" or "leading" @returns Infinite list for My Groups */
export function useMyGroups(role: 'joined' | 'leading') {
  return useInfiniteQuery({
    queryKey: ['groups', 'mine', role],
    queryFn: ({ pageParam }) => groupService.getMyGroups(role, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.page + 1 : undefined,
  });
}

/** @param groupId - Group @param code - Invite code (community) @returns Group page query */
export function useGroup(groupId: string | undefined, code?: string) {
  return useQuery({
    queryKey: ['group', groupId],
    queryFn: () => groupService.getGroup(groupId as string, code),
    enabled: Boolean(groupId),
    refetchInterval: (query) =>
      query.state.data && ['open', 'full', 'auction_live'].includes(query.state.data.status)
        ? GROUP_REFRESH_MS
        : false,
  });
}

/** @returns Mutation that creates a group */
export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: groupService.createGroup,
    onSuccess: (group) => cacheGroup(queryClient, group),
  });
}

/** @returns Mutation that opens a group from an invite code */
export function useJoinByCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: groupService.joinByCode,
    onSuccess: ({ group }) => cacheGroup(queryClient, group),
  });
}

/** Leader action that returns the updated group. */
function useLeaderAction(action: (groupId: string) => Promise<GroupDetail>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: (group) => cacheGroup(queryClient, group),
  });
}

/** @returns Mutation: extend once */
export const useExtendGroup = () => useLeaderAction(groupService.extendGroup);
/** @returns Mutation: start the auction early */
export const useStartAuctionEarly = () => useLeaderAction(groupService.startAuctionEarly);
/** @returns Mutation: cancel an empty group */
export const useCancelGroup = () => useLeaderAction(groupService.cancelGroup);

/** @returns Pending join requests (leader of a community group needing approval) */
export function useJoinRequests(groupId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['group', groupId, 'requests'],
    queryFn: () => groupService.getJoinRequests(groupId as string),
    enabled: Boolean(groupId) && enabled,
  });
}

/** @returns Mutation `{ userId, approve }` for one request */
export function useDecideJoinRequest(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, approve }: { userId: string; approve: boolean }) =>
      groupService.decideJoinRequest(groupId, userId, approve),
    onSuccess: (requests) => queryClient.setQueryData(['group', groupId, 'requests'], requests),
  });
}
