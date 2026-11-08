/**
 * Payment types (mirror /payments — PRD §10.4). Money is integer paise.
 */

/** Data to open Razorpay Checkout (POST /payments/order). */
export interface Checkout {
  paymentId: string;
  orderId: string;
  amountPaise: number;
  currency: 'INR';
  keyId: string;
  reservedUntil: string;
  name: string;
  description: string;
  prefill: { name?: string; contact?: string };
}

export type VerifyOutcome =
  'joined' | 'already_processed' | 'processing' | 'seat_unavailable' | 'mismatch';

export type MoneyEventType =
  | 'paid'
  | 'held'
  | 'refund_started'
  | 'refunded'
  | 'fee_kept'
  | 'sent_to_dealer'
  | 'released'
  | 'returned_from_dealer'
  | 'failed';

export interface MoneyEvent {
  type: MoneyEventType;
  amountPaise: number;
  at: string;
  reason?: string;
  status?: string;
}

/** One token payment with its receipt details and money timeline. */
export interface BuyerPayment {
  id: string;
  groupId: string;
  amountPaise: number;
  currency: string;
  status: 'paid' | 'refunded' | 'partially_refunded' | 'transferred' | 'failed';
  method: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  refundedPaise: number;
  timeline: MoneyEvent[];
}

/** GET /groups/:id/leave-preview */
export interface LeaveTerms {
  canLeave: boolean;
  reason?: 'NOT_A_MEMBER' | 'SEATS_LOCKED';
  refundPaise: number;
  feePaise: number;
  tokenPaise: number;
}
