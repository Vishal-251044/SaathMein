/**
 * Shared enums used by models, services and validators.
 * Values follow the PRD data model (§13) and group lifecycle (§10.3).
 * Always import from here — never type these strings by hand in other files.
 */

/** Group lifecycle statuses (PRD §10.3). Only the group state machine may change them. */
const GROUP_STATUS = Object.freeze({
  OPEN: 'open',
  FULL: 'full',
  AUCTION_LIVE: 'auction_live',
  WON: 'won',
  PURCHASING: 'purchasing',
  RUNNER_UP: 'runner_up',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  NO_DEAL: 'no_deal',
  CANCELLED: 'cancelled',
});

/** Who started the group. */
const GROUP_TYPE = Object.freeze({ BUYER_LED: 'buyer_led', SELLER_LED: 'seller_led' });

/** Public groups show in search; community groups need an invite code. */
const GROUP_VISIBILITY = Object.freeze({ PUBLIC: 'public', COMMUNITY: 'community' });

/** A member's status inside one group. */
const MEMBER_STATUS = Object.freeze({
  ACTIVE: 'active',
  LEFT: 'left',
  WAITLISTED: 'waitlisted',
  ACCEPTED: 'accepted',
  PURCHASED: 'purchased',
  REFUNDED: 'refunded',
  // Community groups with leader approval (GRP-6): asked to join / approved, not paid yet
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

/** Dealer bid status in a live auction. */
const BID_STATUS = Object.freeze({
  ACTIVE: 'active',
  OUTBID: 'outbid',
  WON: 'won',
  RUNNER_UP: 'runner_up',
  LOST: 'lost',
});

/**
 * Token payment status. `failed` is added to the PRD list so a payment.failed
 * webhook has a status to record (PRD §10.4 webhook table).
 */
const PAYMENT_STATUS = Object.freeze({
  CREATED: 'created',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
  TRANSFERRED: 'transferred',
});

/** Append-only ledger entry types (PAY-5). */
const LEDGER_TYPE = Object.freeze({
  TOKEN_HELD: 'token_held',
  REFUND: 'refund',
  TRANSFER: 'transfer',
  HOLD_RELEASE: 'hold_release',
  COMMISSION: 'commission',
  // A Route transfer taken back from the dealer (member exited / dealer backed out, PAY-4)
  TRANSFER_REVERSAL: 'transfer_reversal',
  // Commission given back when its transfer is reversed
  COMMISSION_REVERSAL: 'commission_reversal',
  FEE: 'fee',
  WALLET: 'wallet',
});

/** Admin console staff roles (PRD §8.2). Exactly one Owner exists. */
const STAFF_ROLE = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  DEAL_MANAGER: 'deal_manager',
  FINANCE: 'finance',
  SUPPORT: 'support',
});

/**
 * App roles carried in buyer/seller access tokens (PRD §8.2). Every account is a buyer;
 * "seller" is added when the user belongs to a verified seller (Day 5).
 * Group leader is a per-group permission, not a token role.
 */
const APP_ROLE = Object.freeze({ BUYER: 'buyer', SELLER: 'seller' });

/** JWT audiences — a token for one audience is never accepted by another. */
const TOKEN_AUDIENCE = Object.freeze({
  APP: 'saathmein-app', // buyer app + dealer dashboard
  STAFF: 'saathmein-staff', // owner / admin console
  STAFF_2FA: 'saathmein-staff-2fa', // short-lived token between password and 2FA steps
});

/** Account status for buyers and sellers. */
const ACCOUNT_STATUS = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DELETED: 'deleted',
});

/** Seller KYC review status (TRU-1). */
const KYC_STATUS = Object.freeze({
  NOT_SUBMITTED: 'not_submitted',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

/** Seller subscription plan. */
const SELLER_PLAN = Object.freeze({ FREE: 'free', PRO: 'pro' });

/** How a category's commission is calculated (PRD §5). */
const COMMISSION_TYPE = Object.freeze({
  FLAT: 'flat', // value is in paise per unit
  PERCENT: 'percent', // value is in basis points of the purchase price
});

/** Supported app languages (English, Hindi, Marathi). */
const LANGUAGE = Object.freeze({ EN: 'en', HI: 'hi', MR: 'mr' });

/** Buying timeline chosen during interest onboarding (ACC-3). */
const BUYING_TIMELINE = Object.freeze({
  THIS_MONTH: 'this_month',
  ONE_TO_THREE_MONTHS: '1_3_months',
  EXPLORING: 'exploring',
});

/** Where a priceHistory point came from. */
const PRICE_SOURCE = Object.freeze({ OFFER: 'offer', TIER: 'tier', ADMIN: 'admin' });

/**
 * Return the values of an enum object as an array (for Mongoose `enum` and Zod).
 * @param {Object} enumObject - One of the frozen enums above
 * @returns {string[]} Enum values
 */
/** Socket.io events (PRD §12.3, LIV-1). Server → app unless noted. */
const SOCKET_EVENTS = Object.freeze({
  JOIN_GROUP: 'group:join', // app → server
  LEAVE_GROUP: 'group:leave', // app → server
  GROUP_COUNT: 'group:count',
  GROUP_MEMBER: 'group:member',
  GROUP_STATUS: 'group:status',
  CHAT_MESSAGE: 'chat:message',
  CHAT_UPDATE: 'chat:update',
  NOTIFICATION: 'notification:new',
  // Live auction (AUC-6)
  AUCTION_JOIN: 'auction:join', // dealer web → server
  AUCTION_LOWEST: 'auction:lowest',
  AUCTION_EXTENDED: 'auction:extended',
  AUCTION_WON: 'auction:won',
  AUCTION_RANK: 'auction:rank', // to one dealer: my rank
  DEAL_TIER: 'deal:tier', // seller-led tier unlocked
});

/** Notification types (push + in-app, PRD §10.7). */
const NOTIFICATION_TYPE = Object.freeze({
  GROUP_FULL: 'group_full',
  DEADLINE_SOON: 'deadline_soon',
  LEADER_DECISION: 'leader_decision',
  GROUP_ENDED: 'group_ended',
  AUCTION_STARTED: 'auction_started',
  REFUND_DONE: 'refund_done',
  SEAT_OFFER: 'seat_offer',
  JOIN_REQUEST: 'join_request',
  REQUEST_DECIDED: 'request_decided',
  NEW_LOWEST_PRICE: 'new_lowest_price',
  AUCTION_WON: 'auction_won',
  SINGLE_BID_DECISION: 'single_bid_decision',
  TIER_UNLOCKED: 'tier_unlocked',
  DEALER_AUCTION_OPEN: 'dealer_auction_open',
  DEALER_OUTBID: 'dealer_outbid',
  DEALER_RESULT: 'dealer_result',
  RUNNER_UP_OFFER: 'runner_up_offer',
  // Day 10: purchases
  DEAL_CODE_EXPIRING: 'deal_code_expiring',
  PURCHASE_COMPLETED: 'purchase_completed',
  DEAL_CODE_EXPIRED: 'deal_code_expired',
  DEALER_INVOICE_UPLOADED: 'dealer_invoice_uploaded',
  // Day 11: wallet
  WALLET_CREDITED: 'wallet_credited',
});

/** Why wallet credits moved (REF-1 to REF-3). Credits are not cash and never withdrawable. */
const WALLET_TXN_TYPE = Object.freeze({
  REFERRAL_REFERRER: 'referral_referrer',
  REFERRAL_FRIEND: 'referral_friend',
  LEADER_BONUS: 'leader_bonus',
  ADJUSTMENT: 'adjustment', // staff correction (Day 13)
});

/** Admin curation items (F34). */
const CURATION_TYPE = Object.freeze({ BANNER: 'banner', FEATURED_GROUP: 'featured_group' });

/** One member's purchase from the winning dealer (PUR-1 to PUR-4). */
const PURCHASE_STATUS = Object.freeze({
  PENDING: 'pending', // deal code issued, not bought yet
  INVOICE_UPLOADED: 'invoice_uploaded', // buyer uploaded the invoice; completes after 48 h without objection
  OBJECTED: 'objected', // dealer objected to the invoice (dispute, Day 12)
  COMPLETED: 'completed',
  EXPIRED: 'expired', // price validity ended without a purchase (refund minus back-out fee)
  CANCELLED: 'cancelled', // member left in the exit window, or the dealer backed out
});

/** Commission invoice status (monthly, GST). */
const COMMISSION_INVOICE_STATUS = Object.freeze({ ISSUED: 'issued', PAID: 'paid' });

const values = (enumObject) => Object.values(enumObject);

module.exports = {
  WALLET_TXN_TYPE,
  CURATION_TYPE,
  PURCHASE_STATUS,
  COMMISSION_INVOICE_STATUS,
  SOCKET_EVENTS,
  NOTIFICATION_TYPE,
  GROUP_STATUS,
  GROUP_TYPE,
  GROUP_VISIBILITY,
  MEMBER_STATUS,
  BID_STATUS,
  PAYMENT_STATUS,
  LEDGER_TYPE,
  STAFF_ROLE,
  APP_ROLE,
  TOKEN_AUDIENCE,
  ACCOUNT_STATUS,
  KYC_STATUS,
  SELLER_PLAN,
  COMMISSION_TYPE,
  LANGUAGE,
  BUYING_TIMELINE,
  PRICE_SOURCE,
  values,
};
