'use client';

/**
 * useSellerPurchases — TanStack Query hooks for dealer Purchases (scan / confirm / object),
 * Payouts and commission invoices.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as purchaseService from '@/services/sellerPurchase.service';

/** @param {string} status @param {number} page @returns Query */
export function useSellerPurchases(status, page = 1) {
  return useQuery({
    queryKey: ['seller', 'purchases', status, page],
    queryFn: () => purchaseService.listPurchases({ status, page }),
    placeholderData: keepPreviousData,
  });
}

/** @returns Mutation `code` → purchase preview */
export function useLookupPurchase() {
  return useMutation({ mutationFn: purchaseService.lookupPurchase });
}

/** @returns Mutation `code` → confirmed purchase (refreshes lists and payouts) */
export function useConfirmPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: purchaseService.confirmPurchase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller', 'purchases'] });
      queryClient.invalidateQueries({ queryKey: ['seller', 'payouts'] });
    },
  });
}

/** @returns Mutation `{ purchaseId, reason }` */
export function useObjectToInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: purchaseService.objectToInvoice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seller', 'purchases'] }),
  });
}

/** @returns Mutation `purchaseId` → signed invoice link */
export function useInvoiceUrl() {
  return useMutation({ mutationFn: purchaseService.getInvoiceUrl });
}

/** @param {number} page @returns Query */
export function useSellerPayouts(page = 1) {
  return useQuery({
    queryKey: ['seller', 'payouts', page],
    queryFn: () => purchaseService.getPayouts({ page }),
    placeholderData: keepPreviousData,
  });
}

/** @param {string} invoiceId @returns Query */
export function useSellerCommissionInvoice(invoiceId) {
  return useQuery({
    queryKey: ['seller', 'commission-invoice', invoiceId],
    queryFn: () => purchaseService.getCommissionInvoice(invoiceId),
  });
}
