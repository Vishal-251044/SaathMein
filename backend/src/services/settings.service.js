/**
 * Settings service — admin-editable business values with safe defaults (cached 60 s).
 * Defaults are used until an admin saves a value (the Settings page arrives on Day 11).
 *
 * groups (Day 6, decided by Vishal 30 Oct 2026):
 * - earlyStartThresholdBps: at the deadline, groups at ≥ 70% of target may extend once or
 *   start the auction early (GRP-5); below that they expire.
 * - leaderDecisionHours: how long the leader has to choose (48 h), then the group expires.
 * - extensionDays: one extension adds 7 days (never past the category's maximum deadline).
 * - maxOpenGroupsPerLeader: anti-spam limit on open groups one person leads.
 *
 * auctions (Day 9, PRD §10.5; decided by Vishal 8 Nov 2026):
 * - minRating / minReviewsForRating: dealers rated below 3.5 cannot bid, but verified
 *   dealers with fewer than 3 reviews (unrated) can (open question 2).
 * - minDealerExtensionHours: fewer than 2 dealers → extend once by 24 h.
 * - singleBidDecisionHours: one dealer → the leader has 24 h to accept, else cancel + refund.
 * - exitWindowHours: members may leave after a win (refund minus back-out fee).
 * - runnerUpOfferHours: the runner-up dealer has this long to take the group.
 * - priceAlertMinutes: at most one "new lowest price" push per group in this time.
 * - bidCooldownSeconds: one bid per dealer per few seconds.
 * - backOutSuspensionDays: a winner who backs out cannot bid for this long (PRD §10.5).
 *
 * payments (Day 7):
 * - seatReservationMinutes: a seat is held while the buyer is in checkout.
 * - waitlistOfferHours: a freed seat is offered to the next waitlisted person this long.
 */
const Setting = require('../models/setting.model');
const { createLogger } = require('../utils/logger');

const log = createLogger('Settings');
const CACHE_MS = 60 * 1000;

const DEFAULTS = Object.freeze({
  groups: Object.freeze({
    earlyStartThresholdBps: 7000,
    leaderDecisionHours: 48,
    extensionDays: 7,
    maxOpenGroupsPerLeader: 5,
  }),
  auctions: Object.freeze({
    minRating: 3.5,
    minReviewsForRating: 3,
    minDealerExtensionHours: 24,
    singleBidDecisionHours: 24,
    exitWindowHours: 24,
    runnerUpOfferHours: 24,
    priceAlertMinutes: 30,
    bidCooldownSeconds: 3,
    backOutSuspensionDays: 30, // winner backs out → no auctions for 30 days
  }),
  payments: Object.freeze({
    seatReservationMinutes: 15,
    waitlistOfferHours: 2,
  }),
  // Day 10: purchase completion (PUR-1 to PUR-4)
  purchases: Object.freeze({
    invoiceObjectionHours: 48, // invoice completes the purchase unless the dealer objects in time
    expiryReminderHours: 48, // "your price ends soon" before the deal code expires
    sellerDealValidityDays: 15, // seller-led deals: how long the won price is valid
  }),
  // Day 10: monthly commission invoices (GST). Legal values are placeholders until set in admin.
  billing: Object.freeze({
    legalName: 'SaathMein (legal name not set)',
    gstin: '', // SaathMein GSTIN — set in admin settings before live invoices
    address: '',
    stateCode: '27', // Maharashtra (first two digits of the GSTIN)
    sacCode: '', // confirm with the CA
    gstRateBps: 1800, // 18% GST on commission, added on top (confirm with the CA)
    invoicePrefix: 'SM',
  }),
  // Day 11: referral and wallet credits (REF-1 to REF-3, decided 12 Nov 2026)
  referrals: Object.freeze({
    referrerCreditPaise: 10_000, // ₹100 to the person who shared the link
    friendCreditPaise: 10_000, // ₹100 to the friend, on their first completed purchase
    leaderBonusPaise: 50_000, // ₹500 to the leader when their group completes
    leaderBonusMinOtherPurchases: 3, // leader bought + at least 3 other members bought
    claimWithinDays: 30, // a referral code can be added only by accounts newer than this
  }),
  // Day 12: disputes and penalties (TRU-4, TRU-5)
  disputes: Object.freeze({
    sellerResponseHours: 48, // dealer must answer within this time, else escalated
    suspensionDays: 30, // default auction suspension for a penalty
    maxEvidenceFiles: 6,
  }),
  // Day 11: feature flags (F35)
  flags: Object.freeze({
    referrals: true,
    sellerDeals: true,
    communityGroups: true,
    maintenanceMode: false, // buyers and dealers see "back soon"; admin keeps working
  }),
});

const cache = new Map();

/**
 * One settings section merged over its defaults.
 * @param {'groups'} key - Section key
 * @returns {Promise<Object>} Section values
 */
const getSettings = async (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.loadedAt < CACHE_MS) return cached.value;

  let stored = null;
  try {
    stored = await Setting.findOne({ key }).lean();
  } catch (err) {
    // Fall back to defaults so a settings read never breaks a request
    log.error({ err: err.message, key }, 'Could not read settings, using defaults');
  }
  const value = { ...DEFAULTS[key], ...(stored?.value || {}) };
  cache.set(key, { value, loadedAt: Date.now() });
  return value;
};

/** @returns {Promise<typeof DEFAULTS.groups>} Group lifecycle settings */
const getGroupSettings = () => getSettings('groups');

/** @returns {Promise<typeof DEFAULTS.auctions>} Live auction rules */
const getAuctionSettings = () => getSettings('auctions');

/** @returns {Promise<typeof DEFAULTS.payments>} Checkout and waitlist settings */
const getPaymentSettings = () => getSettings('payments');

/** @returns {Promise<typeof DEFAULTS.purchases>} Purchase completion settings */
const getPurchaseSettings = () => getSettings('purchases');

/** @returns {Promise<typeof DEFAULTS.billing>} Commission invoice (GST) settings */
const getBillingSettings = () => getSettings('billing');

/** @returns {Promise<typeof DEFAULTS.referrals>} Referral and wallet credit amounts */
const getReferralSettings = () => getSettings('referrals');

/** @returns {Promise<typeof DEFAULTS.disputes>} Dispute and penalty rules */
const getDisputeSettings = () => getSettings('disputes');

/** @returns {Promise<typeof DEFAULTS.flags>} Feature flags */
const getFeatureFlags = () => getSettings('flags');

/** Forget cached values (after an admin edit, and in tests). */
const clearSettingsCache = () => cache.clear();

module.exports = {
  DEFAULTS,
  getSettings,
  getGroupSettings,
  getPurchaseSettings,
  getReferralSettings,
  getFeatureFlags,
  getDisputeSettings,
  getBillingSettings,
  getPaymentSettings,
  getAuctionSettings,
  clearSettingsCache,
};
