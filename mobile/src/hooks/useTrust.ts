/**
 * useTrust — reports, disputes (open with photos, list, detail) and dealer profiles.
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { pickInvoiceImage } from '@/lib/imagePicker';
import * as trustService from '@/services/trust.service';
import type { OpenDisputeInput } from '@/types/trust';

/** @returns Mutation that files a report */
export function useCreateReport() {
  return useMutation({ mutationFn: trustService.createReport });
}

/** @returns Mutation: pick a photo (camera or gallery) and upload it privately; null if cancelled */
export function useAddEvidence() {
  return useMutation({
    mutationFn: async (source: 'camera' | 'library') => {
      const image = await pickInvoiceImage(source);
      return image ? trustService.uploadDisputeEvidence(image) : null;
    },
  });
}

/** @returns Mutation that opens a dispute and refreshes my lists */
export function useOpenDispute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: OpenDisputeInput) => trustService.openDispute(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['disputes'] }),
  });
}

/** @returns Infinite list of my disputes */
export function useMyDisputes() {
  return useInfiniteQuery({
    queryKey: ['disputes', 'mine'],
    queryFn: ({ pageParam }) => trustService.getMyDisputes(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.hasNextPage ? last.meta.page + 1 : undefined),
  });
}

/** @param disputeId @returns One dispute */
export function useMyDispute(disputeId: string | undefined) {
  return useQuery({
    queryKey: ['disputes', disputeId],
    queryFn: () => trustService.getMyDispute(disputeId as string),
    enabled: Boolean(disputeId),
  });
}

/** @param sellerId @returns Dealer profile */
export function useDealer(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['dealer', sellerId],
    queryFn: () => trustService.getDealer(sellerId as string),
    enabled: Boolean(sellerId),
  });
}

/** @param sellerId @returns Infinite list of reviews */
export function useDealerReviews(sellerId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['dealer', sellerId, 'reviews'],
    queryFn: ({ pageParam }) => trustService.getDealerReviews(sellerId as string, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.hasNextPage ? last.meta.page + 1 : undefined),
    enabled: Boolean(sellerId),
  });
}
