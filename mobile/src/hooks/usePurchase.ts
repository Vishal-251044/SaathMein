/**
 * usePurchase — invoice upload (camera / gallery → private upload → attach) and dealer
 * review mutations. Both refresh the group page, which carries `myPurchase`. Also
 * useMyDealCodes for the "My deal codes" screen (kept offline).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { pickInvoiceImage } from '@/lib/imagePicker';
import * as purchaseService from '@/services/purchase.service';

/**
 * @param groupId - Group of the purchase (to refresh its page)
 * @returns Mutation `{ purchaseId, source }`; resolves to null when the user cancels
 */
export function useUploadInvoice(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      purchaseId,
      source,
    }: {
      purchaseId: string;
      source: 'camera' | 'library';
    }) => {
      const image = await pickInvoiceImage(source);
      if (!image) return null;
      return purchaseService.uploadInvoice(purchaseId, image);
    },
    onSuccess: (purchase) => {
      if (purchase) queryClient.invalidateQueries({ queryKey: ['group', groupId] });
    },
  });
}

/** @param groupId - Group of the purchase @returns Mutation `{ purchaseId, rating, text? }` */
export function useCreateReview(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: purchaseService.createReview,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group', groupId] }),
  });
}

/** @returns My open and completed deal codes (saved for offline use at the showroom) */
export function useMyDealCodes() {
  return useQuery({ queryKey: ['purchases', 'mine'], queryFn: purchaseService.getMyDealCodes });
}
