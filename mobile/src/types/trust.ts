/**
 * Reports, disputes and dealer profile types (TRU-2 to TRU-5).
 */
import type { PublicDealer } from './group';

export type ReportTarget = 'group' | 'member' | 'seller' | 'message' | 'review';
export type ReportReason = 'spam' | 'fraud' | 'abuse' | 'price_not_honoured' | 'other';

export type DisputeStatus = 'awaiting_seller' | 'seller_responded' | 'seller_missed' | 'resolved';
export type DisputeType = 'price_not_honoured' | 'product_issue' | 'invoice_objection' | 'other';

export interface Dispute {
  id: string;
  groupId: string;
  purchaseId: string;
  type: DisputeType;
  status: DisputeStatus;
  description: string;
  quotedPricePaise: number | null;
  evidence: {
    addedBy: 'buyer' | 'seller';
    addedAt: string;
    format: string | null;
    url: string | null;
  }[];
  sellerDueAt: string | null;
  sellerResponse: { text: string; at: string } | null;
  decision: {
    outcome: 'refund' | 'credit' | 'no_refund';
    refundPaise: number | null;
    creditPaise: number | null;
    note: string;
    at: string;
  } | null;
  timeline: { at: string; actorType: string; action: string; note: string | null }[];
  createdAt: string;
}

export interface DisputePage {
  disputes: Dispute[];
  meta: { page: number; totalPages: number; hasNextPage: boolean };
}

export interface OpenDisputeInput {
  purchaseId: string;
  type: Exclude<DisputeType, 'invoice_objection'>;
  description: string;
  quotedPricePaise?: number;
  evidence?: {
    publicId: string;
    version: number;
    signature: string;
    format?: 'jpg' | 'jpeg' | 'png' | 'pdf';
  }[];
}

export interface DealerProfile extends Omit<PublicDealer, 'address'> {
  categoryIds: string[];
  memberSince: string;
  groupsWon: number;
}

export interface DealerReview {
  id: string;
  rating: number;
  text: string | null;
  buyerFirstName: string | null;
  createdAt: string;
}

export interface DealerReviewPage {
  reviews: DealerReview[];
  meta: { page: number; totalPages: number; hasNextPage: boolean; total: number };
}
