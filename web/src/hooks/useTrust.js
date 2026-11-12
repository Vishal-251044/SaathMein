'use client';

/**
 * useTrust — TanStack Query hooks for the Support Disputes / Reports queue and the
 * dealer's Disputes page.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as trustService from '@/services/trust.service';

/** @param {Object} params @returns Query */
export function useAdminDisputes(params) {
  return useQuery({
    queryKey: ['admin', 'disputes', params],
    queryFn: () => trustService.listAdminDisputes(params),
    placeholderData: keepPreviousData,
  });
}

/** @param {string} disputeId @returns Query */
export function useAdminDispute(disputeId) {
  return useQuery({
    queryKey: ['admin', 'dispute', disputeId],
    queryFn: () => trustService.getAdminDispute(disputeId),
  });
}

/** @returns Mutation that decides a dispute and refreshes the queue */
export function useDecideDispute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: trustService.decideDispute,
    onSuccess: (_dispute, { disputeId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'disputes'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dispute', disputeId] });
    },
  });
}

/** @param {Object} params @returns Query */
export function useAdminReports(params) {
  return useQuery({
    queryKey: ['admin', 'reports', params],
    queryFn: () => trustService.listAdminReports(params),
    placeholderData: keepPreviousData,
  });
}

/** @returns Mutation that decides a report */
export function useDecideReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: trustService.decideReport,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] }),
  });
}

/** @param {Object} params @returns Query */
export function useSellerDisputes(params) {
  return useQuery({
    queryKey: ['seller', 'disputes', params],
    queryFn: () => trustService.listSellerDisputes(params),
    placeholderData: keepPreviousData,
  });
}

/** @param {string} disputeId @returns Query */
export function useSellerDispute(disputeId) {
  return useQuery({
    queryKey: ['seller', 'dispute', disputeId],
    queryFn: () => trustService.getSellerDispute(disputeId),
  });
}

/** @returns Mutation `{ disputeId, text, evidence }` */
export function useRespondToDispute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: trustService.respondToDispute,
    onSuccess: (dispute, { disputeId }) => {
      queryClient.setQueryData(['seller', 'dispute', disputeId], dispute);
      queryClient.invalidateQueries({ queryKey: ['seller', 'disputes'] });
    },
  });
}
