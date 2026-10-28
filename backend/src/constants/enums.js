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
const values = (enumObject) => Object.values(enumObject);

module.exports = {
  GROUP_STATUS,
  GROUP_TYPE,
  GROUP_VISIBILITY,
  MEMBER_STATUS,
  BID_STATUS,
  PAYMENT_STATUS,
  LEDGER_TYPE,
  STAFF_ROLE,
  ACCOUNT_STATUS,
  KYC_STATUS,
  SELLER_PLAN,
  COMMISSION_TYPE,
  LANGUAGE,
  BUYING_TIMELINE,
  PRICE_SOURCE,
  values,
};
