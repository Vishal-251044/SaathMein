/**
 * Payment service — token checkout, verification, receipts, leaving and the waitlist
 * (PRD §10.4). The amount always comes from the server.
 */
import type { GroupDetail } from '@/types/group';
import type { BuyerPayment, Checkout, LeaveTerms, VerifyOutcome } from '@/types/payment';

import { api, unwrap } from './api';

/** Start a checkout for a group (holds a seat for a few minutes). */
export async function createOrder(groupId: string, code?: string): Promise<Checkout> {
  const data = await unwrap<{ checkout: Checkout }>(
    api.post('/payments/order', { groupId, ...(code ? { code } : {}) }),
  );
  return data.checkout;
}

/** Send Razorpay's result to the server, which checks the signature and joins. */
export function verifyPayment(input: {
  orderId: string;
  razorpayPaymentId: string;
  signature: string;
}): Promise<{ outcome: VerifyOutcome; groupId: string }> {
  return unwrap(api.post('/payments/verify', input));
}

/** The buyer closed Checkout: free the seat hold for others. */
export async function cancelCheckout(paymentId: string): Promise<void> {
  await api.post(`/payments/${paymentId}/cancel`);
}

/** My payments for one group (receipts + money timeline). */
export async function getGroupPayments(groupId: string): Promise<BuyerPayment[]> {
  const data = await unwrap<{ payments: BuyerPayment[] }>(
    api.get('/payments/me', { params: { groupId } }),
  );
  return data.payments;
}

/** What leaving would refund. */
export async function getLeavePreview(groupId: string): Promise<LeaveTerms> {
  return (await unwrap<{ terms: LeaveTerms }>(api.get(`/groups/${groupId}/leave-preview`))).terms;
}

/** Leave the group; the refund is queued. */
export async function leaveGroup(
  groupId: string,
): Promise<{ terms: LeaveTerms; group: GroupDetail }> {
  return unwrap(api.post(`/groups/${groupId}/leave`));
}

/** Join the waitlist of a full group. */
export async function joinWaitlist(
  groupId: string,
  code?: string,
): Promise<{ position: number; group: GroupDetail }> {
  return unwrap(api.post(`/groups/${groupId}/waitlist`, code ? { code } : {}));
}

/** Leave the waitlist. */
export async function leaveWaitlist(groupId: string): Promise<void> {
  await api.delete(`/groups/${groupId}/waitlist`);
}
