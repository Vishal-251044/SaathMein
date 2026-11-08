/**
 * Payment hooks (TanStack Query): the pay flow (order → Razorpay Checkout → verify), the
 * money timeline, leaving with a refund preview and the waitlist. Every success refreshes
 * the group and My Groups.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { openCheckout } from '@/lib/razorpay';
import * as paymentService from '@/services/payment.service';
import { brand } from '@/theme/tokens';
import type { GroupDetail } from '@/types/group';

/** Refresh everything that shows this group. */
function useRefreshGroup() {
  const queryClient = useQueryClient();
  return (groupId: string, group?: GroupDetail) => {
    if (group) queryClient.setQueryData(['group', groupId], group);
    queryClient.invalidateQueries({ queryKey: ['group', groupId] });
    queryClient.invalidateQueries({ queryKey: ['groups'] });
    queryClient.invalidateQueries({ queryKey: ['payments', groupId] });
  };
}

/**
 * Pay the token: server order → Razorpay Checkout → server verification.
 * Closing Checkout frees the seat hold. Errors: CheckoutError (cancelled / unavailable /
 * failed) or ApiClientError.
 * @returns Mutation `{ groupId, code? }` resolving to the server's outcome
 */
export function usePayToken() {
  const refresh = useRefreshGroup();
  return useMutation({
    mutationFn: async ({ groupId, code }: { groupId: string; code?: string }) => {
      const checkout = await paymentService.createOrder(groupId, code);
      let result;
      try {
        result = await openCheckout({
          keyId: checkout.keyId,
          orderId: checkout.orderId,
          amountPaise: checkout.amountPaise,
          name: checkout.name,
          description: checkout.description,
          prefill: checkout.prefill,
          themeColor: brand.primary,
        });
      } catch (error) {
        // Free the seat for others; never blocks the error shown to the buyer
        paymentService.cancelCheckout(checkout.paymentId).catch(() => {});
        throw error;
      }
      return paymentService.verifyPayment({
        orderId: result.razorpay_order_id,
        razorpayPaymentId: result.razorpay_payment_id,
        signature: result.razorpay_signature,
      });
    },
    onSettled: (_data, _error, { groupId }) => refresh(groupId),
  });
}

/** @returns My payments for this group (receipts + money timeline) */
export function useGroupPayments(groupId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['payments', groupId],
    queryFn: () => paymentService.getGroupPayments(groupId as string),
    enabled: Boolean(groupId) && enabled,
  });
}

/** @returns Refund preview for the leave sheet */
export function useLeavePreview(groupId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['group', groupId, 'leave-preview'],
    queryFn: () => paymentService.getLeavePreview(groupId),
    enabled,
    staleTime: 0,
  });
}

/** @returns Mutation that leaves the group */
export function useLeaveGroup(groupId: string) {
  const refresh = useRefreshGroup();
  return useMutation({
    mutationFn: () => paymentService.leaveGroup(groupId),
    onSuccess: ({ group }) => refresh(groupId, group),
  });
}

/** @returns Mutations to join or leave the waitlist */
export function useWaitlist(groupId: string) {
  const refresh = useRefreshGroup();
  const join = useMutation({
    mutationFn: (code?: string) => paymentService.joinWaitlist(groupId, code),
    onSuccess: ({ group }) => refresh(groupId, group),
  });
  const leave = useMutation({
    mutationFn: () => paymentService.leaveWaitlist(groupId),
    onSuccess: () => refresh(groupId),
  });
  return { join, leave };
}
