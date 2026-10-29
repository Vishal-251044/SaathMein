'use client';

/**
 * useAdminSellers — TanStack Query hooks for Admin → Sellers (KYC queue and review),
 * product requests and the audit log.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as sellersService from '@/services/adminSellers.service';

const SELLERS_KEY = ['admin', 'sellers'];

/** @param {Object} filters - kycStatus, q, page, limit @returns Paginated sellers query */
export function useAdminSellers(filters) {
  return useQuery({
    queryKey: [...SELLERS_KEY, 'list', filters],
    queryFn: () => sellersService.listSellers(filters),
    placeholderData: keepPreviousData,
  });
}

/** @param {string} sellerId @returns Seller detail query (document links last 10 minutes) */
export function useAdminSeller(sellerId) {
  return useQuery({
    queryKey: [...SELLERS_KEY, 'detail', sellerId],
    queryFn: () => sellersService.getSeller(sellerId),
    enabled: Boolean(sellerId),
    staleTime: 5 * 60_000,
  });
}

/**
 * Review mutation: caches the updated seller and refreshes lists and the activity log.
 * @param {(input: Object) => Promise<Object>} mutationFn - Service call
 * @returns Mutation
 */
const useReviewMutation = (mutationFn) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (seller) => {
      queryClient.setQueryData([...SELLERS_KEY, 'detail', seller.id], seller);
      queryClient.invalidateQueries({ queryKey: [...SELLERS_KEY, 'list'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
    },
  });
};

/** @returns Mutation `{ sellerId, note? }` */
export const useApproveKyc = () =>
  useReviewMutation(({ sellerId, note }) => sellersService.approveKyc(sellerId, note));
/** @returns Mutation `{ sellerId, reason }` */
export const useRejectKyc = () =>
  useReviewMutation(({ sellerId, reason }) => sellersService.rejectKyc(sellerId, reason));
/** @returns Mutation `{ sellerId }` */
export const useRetryPayoutSetup = () =>
  useReviewMutation(({ sellerId }) => sellersService.retryPayoutSetup(sellerId));

/** @param {Object} filters - targetType, targetId, page @param {boolean} enabled */
export function useAuditLogs(filters, enabled = true) {
  return useQuery({
    queryKey: ['admin', 'audit', filters],
    queryFn: () => sellersService.listAuditLogs(filters),
    enabled,
  });
}

/** @param {Object} filters - status, page @returns Paginated product requests */
export function useProductRequests(filters) {
  return useQuery({
    queryKey: ['admin', 'product-requests', filters],
    queryFn: () => sellersService.listProductRequests(filters),
    placeholderData: keepPreviousData,
  });
}

/** @returns Mutation `{ requestId, changes }` */
export function useUpdateProductRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, changes }) => sellersService.updateProductRequest(requestId, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'product-requests'] }),
  });
}
