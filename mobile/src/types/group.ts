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
  leader: { firstName: string | null } | null;
  members: GroupMemberPreview[];
  myMembership: {
    status: MembershipStatus;
    joinedAt: string;
    waitlistPosition: number | null;
    /** A freed seat is held for me until then (pay to take it). */
    seatOfferExpiresAt: string | null;
  } | null;
  /** Kept from the token if I leave after seats lock. */
  backoutFeePaise: number;
  statusHistory: GroupStatusEntry[];
  auction: { startsAt: string; endsAt: string; dealerCount: number } | null;
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
