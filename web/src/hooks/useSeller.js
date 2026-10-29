'use client';

/**
 * useSeller — TanStack Query hooks for the dealer dashboard (profile, KYC, team) and the
 * public city / category lists the forms use. Mutations write the returned data to cache.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as sellerService from '@/services/seller.service';

export const SELLER_ME_KEY = ['seller', 'me'];
export const SELLER_TEAM_KEY = ['seller', 'team'];

/** @param {{ enabled?: boolean }} [options] @returns Query with the dealer */
export function useSellerMe({ enabled = true } = {}) {
  return useQuery({ queryKey: SELLER_ME_KEY, queryFn: sellerService.getMe, enabled });
}

/** @returns Mutation that saves profile changes */
export function useUpdateSellerProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sellerService.updateProfile,
    onSuccess: (seller) => queryClient.setQueryData(SELLER_ME_KEY, seller),
  });
}

/** @returns Mutation that submits the KYC form */
export function useSubmitKyc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sellerService.submitKyc,
    onSuccess: (seller) => queryClient.setQueryData(SELLER_ME_KEY, seller),
  });
}

/** @returns Query with the team members and pending invites */
export function useSellerTeam() {
  return useQuery({ queryKey: SELLER_TEAM_KEY, queryFn: sellerService.getTeam });
}

/**
 * Team mutation that replaces the cached team with the API's answer.
 * @param {(input: *) => Promise<Object>} mutationFn - Team service call
 * @returns Mutation
 */
const useTeamMutation = (mutationFn) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (team) => queryClient.setQueryData(SELLER_TEAM_KEY, team),
  });
};

/** @returns Mutation `{ email, name? }` */
export const useInviteMember = () => useTeamMutation(sellerService.inviteMember);
/** @returns Mutation `inviteId` */
export const useRevokeInvite = () => useTeamMutation(sellerService.revokeInvite);
/** @returns Mutation `userId` */
export const useRemoveMember = () => useTeamMutation(sellerService.removeMember);

/** @returns Mutation that sends a missing-product request */
export function useRequestProduct() {
  return useMutation({ mutationFn: sellerService.requestProduct });
}

/** @returns Query with active cities (public, cached for 10 minutes) */
export function usePublicCities() {
  return useQuery({
    queryKey: ['public', 'cities'],
    queryFn: sellerService.listCities,
    staleTime: 10 * 60_000,
  });
}

/** @returns Query with the active category tree (public, cached for 10 minutes) */
export function usePublicCategories() {
  return useQuery({
    queryKey: ['public', 'categories'],
    queryFn: sellerService.listCategories,
    staleTime: 10 * 60_000,
  });
}
