'use client';

/**
 * useAdminCommissions — TanStack Query hooks for Admin → Commissions (list, totals,
 * invoices, issuing a month) and the public city / category lists used as filters.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as commissionsService from '@/services/adminCommissions.service';

/** @param {Object} params - Filters + page @returns Query */
export function useAdminCommissions(params) {
  return useQuery({
    queryKey: ['admin', 'commissions', params],
    queryFn: () => commissionsService.listCommissions(params),
    placeholderData: keepPreviousData,
  });
}

/** @param {Object} params - month + page @returns Query */
export function useAdminCommissionInvoices(params) {
  return useQuery({
    queryKey: ['admin', 'commission-invoices', params],
    queryFn: () => commissionsService.listInvoices(params),
    placeholderData: keepPreviousData,
  });
}

/** @param {string} invoiceId @returns Query */
export function useAdminCommissionInvoice(invoiceId) {
  return useQuery({
    queryKey: ['admin', 'commission-invoice', invoiceId],
    queryFn: () => commissionsService.getInvoice(invoiceId),
  });
}

/** @returns Mutation `month` that issues a finished month's invoices */
export function useGenerateInvoices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: commissionsService.generateInvoices,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'commission-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'commissions'] });
    },
  });
}

/** @returns Query with public cities + categories for filters (10 min cache) */
export function useCommissionFilterOptions() {
  return useQuery({
    queryKey: ['public', 'filter-options'],
    queryFn: async () => {
      const [cities, categories] = await Promise.all([
        commissionsService.listPublicCities(),
        commissionsService.listPublicCategories(),
      ]);
      return { cities, categories };
    },
    staleTime: 10 * 60_000,
  });
}
