/**
 * Group types (mirror GET /groups, GET /groups/:id — PRD §10.3).
 */
import type { ProductCard } from './catalog';

export type GroupStatus =
  | 'open'
  | 'full'
  | 'auction_live'
  | 'won'
  | 'purchasing'
  | 'runner_up'
  | 'completed'
  | 'expired'
  | 'no_deal'
  | 'cancelled';

export type GroupVisibility = 'public' | 'community';

export type MembershipStatus =
  | 'active'
  | 'left'
  | 'waitlisted'
  | 'accepted'
  | 'purchased'
  | 'refunded'
  | 'pending_approval'
  | 'approved'
  | 'rejected';

/** Group in lists and on the product page. */
export interface GroupCard {
  id: string;
  type: 'buyer_led' | 'seller_led';
  visibility: GroupVisibility;
  status: GroupStatus;
  product: ProductCard;
  variantKey: string | null;
  variantName: string | null;
  cityId: string | null;
  memberCount: number;
  targetSize: number;
  seatsLeft: number;
  tokenAmountPaise: number;
  deadline: string;
  isLeader: boolean;
  createdAt: string;
  /** Only in My Groups → Joined. */
  myMembershipStatus?: MembershipStatus | null;
}

export interface GroupMemberPreview {
  /** Opaque id (reports only). Absent in live "new member" events. */
  id?: string;
  firstName: string | null;
  avatarUrl: string | null;
  isLeader: boolean;
}

export interface GroupStatusEntry {
  from: GroupStatus | null;
  to: GroupStatus;
  reason: string | null;
  at: string;
}

/** Full group page. */
export interface GroupDetail extends GroupCard {
  note: string | null;
  requiresApproval: boolean;
  /** Only for the leader and members (for sharing). */
  inviteCode: string | null;
  /** https share link (opens the app through Android App Links). */
  shareUrl: string | null;
  leader: { firstName: string | null } | null;
  members: GroupMemberPreview[];
  myMembership: {
    status: MembershipStatus;
    joinedAt: string;
    waitlistPosition: number | null;
    /** A freed seat is held for me until then (pay to take it). */
    seatOfferExpiresAt: string | null;
    /** Show at the dealer after the group is won (AUC-8). */
    dealCode: string | null;
  } | null;
  /** Kept from the token if I leave after seats lock. */
  backoutFeePaise: number;
  statusHistory: GroupStatusEntry[];
  auction: GroupAuction | null;
  /** Seller-led deals only (AUC-9). */
  deal: GroupDeal | null;
  /** My purchase after a win: deal-code ticket, invoice, review, saving (Day 10). */
  myPurchase: GroupPurchase | null;
  /** Price per unit after a win. */
  winningPricePaise: number | null;
  /** Members may leave (refund minus back-out fee) until then. */
  exitWindowEndsAt: string | null;
  leaderDecision: { dueAt: string; canExtend: boolean; canStartEarly: boolean } | null;
  awaitingLeaderDecision: boolean;
  canCancel: boolean;
}

export interface CreateGroupInput {
  productId: string;
  variantKey: string | null;
  targetSize: number;
  deadlineDays: number;
  visibility: GroupVisibility;
  requiresApproval?: boolean;
  note?: string;
}

export interface GroupPage {
  groups: GroupCard[];
  meta: { page: number; limit: number; total: number; totalPages: number; hasNextPage: boolean };
}

export type JoinNextStep = 'view' | 'pay_token' | 'wait_for_approval' | 'declined';

export interface JoinRequest {
  userId: string;
  firstName: string | null;
  avatarUrl: string | null;
  requestedAt: string;
}

/** Public dealer card (winner of an auction, or the dealer of a seller-led deal). */
export interface PublicDealer {
  id: string;
  businessName: string;
  area: string | null;
  rating: number | null;
  ratingCount: number;
  verified: boolean;
  address: { line1?: string; area?: string; pincode?: string } | null;
}

/** Live auction for buyers (AUC-9): anonymous falling price, never dealer names while live. */
export interface GroupAuction {
  status: GroupStatus;
  ceilingPaise: number | null;
  lowestPricePaise: number | null;
  savedPerMemberPaise: number | null;
  dealerCount: number;
  joinedDealerCount: number;
  bidCount: number;
  startsAt: string | null;
  endsAt: string | null;
  extensions: number;
  closedAt: string | null;
  paused: boolean;
  history: { pricePaise: number; at: string }[];
  winner: (PublicDealer & { pricePaise: number | null }) | null;
  /** Only one dealer bid: the leader accepts that price or cancels (decided 8 Nov 2026). */
  singleBidDecision: { dueAt: string; pricePaise: number; canDecide: boolean } | null;
}

export interface DealTier {
  size: number;
  discountBps: number;
  pricePaise: number;
}

/** Seller-led deal (AUC-9): price drops as tiers unlock. */
export interface GroupDeal {
  basePricePaise: number;
  tiers: DealTier[];
  currentTier: DealTier | null;
  nextTier: DealTier | null;
  pricePaise: number;
  membersToNext: number | null;
  seller: PublicDealer | null;
}

export type PurchaseStatus =
  'pending' | 'invoice_uploaded' | 'objected' | 'completed' | 'expired' | 'cancelled';

/** My purchase from the winning dealer (PUR-1 to PUR-4). */
export interface GroupPurchase {
  id: string;
  groupId: string;
  status: PurchaseStatus;
  dealCode: string;
  /** Signed QR payload; only while the code can be used. */
  qrPayload: string | null;
  pricePaise: number;
  tokenPaise: number;
  /** Price minus the token already paid (token is part-payment). */
  payAtShopPaise: number;
  savedPaise: number | null;
  validUntil: string;
  invoiceUploadedAt: string | null;
  autoCompleteAt: string | null;
  completedAt: string | null;
  canReview: boolean;
  reviewedAt: string | null;
}

/** A row of "My deal codes": the purchase plus what was bought and where. */
export interface MyDealCode extends GroupPurchase {
  productName: string | null;
  dealerName: string | null;
}
