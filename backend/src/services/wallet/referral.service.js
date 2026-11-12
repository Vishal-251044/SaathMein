/**
 * Referrals and the group-leader bonus (REF-1, REF-2; decided 12 Nov 2026).
 * - Every user has a referral code and link (https://<domain>/r/<code>).
 * - A new account (within `claimWithinDays`, no completed purchase yet) can add a friend's
 *   code once. When that friend completes their FIRST purchase, both get credits
 *   (₹100 + ₹100 by default) — once per referred friend.
 * - Leader bonus (₹500): when the group completes, the leader's own purchase completed
 *   and at least 3 other members completed theirs (stops fake groups).
 * Amounts and rules come from `settings.referrals`; switched off by `flags.referrals`.
 * Reward hooks never throw (they run after the purchase / group change).
 */
const Group = require('../../models/group.model');
const Purchase = require('../../models/purchase.model');
const User = require('../../models/user.model');
const WalletTransaction = require('../../models/walletTransaction.model');
const config = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { generateCode } = require('../../helpers/genericFunctions');
const { getFeatureFlags, getReferralSettings } = require('../settings.service');
const { creditWallet } = require('./wallet.service');
const {
  ACCOUNT_STATUS,
  GROUP_STATUS,
  PURCHASE_STATUS,
  WALLET_TXN_TYPE,
} = require('../../constants/enums');

const log = createLogger('ReferralService');
const DAY_MS = 24 * 60 * 60 * 1000;
const CODE_LENGTH = 8;

/** @param {string} code @returns {string} Share link */
const referralLink = (code) => `${config.appLinks.baseUrl}/r/${code}`;

/**
 * The user's referral code (created on first use).
 * @param {string} userId
 * @returns {Promise<string>}
 */
const ensureReferralCode = async (userId) => {
  const user = await User.findById(userId).select('referralCode').lean();
  if (!user) throw ApiError.notFound('User not found');
  if (user.referralCode) return user.referralCode;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const updated = await User.findOneAndUpdate(
        { _id: userId, referralCode: { $exists: false } },
        { $set: { referralCode: generateCode(CODE_LENGTH) } },
        { new: true, projection: { referralCode: 1 } },
      ).lean();
      if (updated) return updated.referralCode;
      return (await User.findById(userId).select('referralCode').lean()).referralCode;
    } catch (err) {
      if (err?.code !== 11000) throw err; // code taken: try another
    }
  }
  throw new ApiError(503, 'Could not create a referral code. Please try again.', {
    code: 'REFERRAL_CODE_FAILED',
  });
};

/**
 * Referral card for the wallet screen.
 * @param {string} userId
 */
const getReferral = async (userId) => {
  const [code, settings, flags, user, invited, earned] = await Promise.all([
    ensureReferralCode(userId),
    getReferralSettings(),
    getFeatureFlags(),
    User.findById(userId).select('referredBy createdAt').lean(),
    User.countDocuments({ referredBy: userId }),
    WalletTransaction.countDocuments({ userId, type: WALLET_TXN_TYPE.REFERRAL_REFERRER }),
  ]);
  const claimOpen =
    !user?.referredBy &&
    Date.now() - new Date(user?.createdAt || 0).getTime() <= settings.claimWithinDays * DAY_MS;
  return {
    enabled: flags.referrals,
    code,
    link: referralLink(code),
    referrerCreditPaise: settings.referrerCreditPaise,
    friendCreditPaise: settings.friendCreditPaise,
    leaderBonusPaise: settings.leaderBonusPaise,
    invitedCount: invited,
    rewardedCount: earned,
    referredBy: Boolean(user?.referredBy),
    canAddCode: flags.referrals && claimOpen,
  };
};

/**
 * A new user adds a friend's referral code (once).
 * @param {string} userId
 * @param {string} rawCode
 * @param {Date} [now]
 * @throws {ApiError} 403 disabled, 409 not allowed / already, 404 unknown code, 422 own code
 */
const applyReferralCode = async (userId, rawCode, now = new Date()) => {
  const [flags, settings] = await Promise.all([getFeatureFlags(), getReferralSettings()]);
  if (!flags.referrals)
    throw new ApiError(403, 'Referrals are paused right now', { code: 'REFERRALS_OFF' });
  const code = String(rawCode || '')
    .trim()
    .toUpperCase();
  const user = await User.findById(userId).select('referredBy referralCode createdAt').lean();
  if (!user) throw ApiError.notFound('User not found');
  if (user.referredBy)
    throw ApiError.conflict('You already added a referral code', { code: 'REFERRAL_ALREADY_SET' });
  if (now.getTime() - new Date(user.createdAt).getTime() > settings.claimWithinDays * DAY_MS) {
    throw ApiError.conflict('Referral codes can be added only by new accounts', {
      code: 'REFERRAL_TOO_LATE',
    });
  }
  if (await Purchase.exists({ userId, status: PURCHASE_STATUS.COMPLETED })) {
    throw ApiError.conflict('Referral codes can be added only before your first purchase', {
      code: 'REFERRAL_TOO_LATE',
    });
  }
  if (user.referralCode && user.referralCode === code) {
    throw new ApiError(422, 'You cannot use your own code', { code: 'OWN_REFERRAL_CODE' });
  }
  const referrer = await User.findOne({ referralCode: code, status: ACCOUNT_STATUS.ACTIVE })
    .select('_id referredBy')
    .lean();
  if (!referrer)
    throw new ApiError(404, 'This referral code is not valid', { code: 'REFERRAL_CODE_INVALID' });
  if (String(referrer.referredBy) === String(userId)) {
    // A refers B and B refers A: only the first link counts
    throw ApiError.conflict('You invited this person, so you cannot use their code', {
      code: 'REFERRAL_LOOP',
    });
  }
  const updated = await User.updateOne(
    { _id: userId, referredBy: { $exists: false } },
    { $set: { referredBy: referrer._id } },
  );
  if (!updated.modifiedCount)
    throw ApiError.conflict('You already added a referral code', { code: 'REFERRAL_ALREADY_SET' });
  log.info({ userId, referrerId: String(referrer._id) }, 'Referral code added');
  return getReferral(userId);
};

/**
 * After a completed purchase: referral credits on the friend's first purchase (REF-1).
 * Never throws.
 * @param {Object} purchase - Completed purchase (lean)
 */
const onPurchaseCompleted = async (purchase) => {
  try {
    const flags = await getFeatureFlags();
    if (!flags.referrals) return;
    const buyer = await User.findById(purchase.userId).select('referredBy').lean();
    if (!buyer?.referredBy) return;
    const referrer = await User.findById(buyer.referredBy).select('status').lean();
    const settings = await getReferralSettings();
    const friendId = String(purchase.userId);
    // Keys are per friend: only the first completed purchase pays
    await creditWallet({
      userId: friendId,
      amountPaise: settings.friendCreditPaise,
      type: WALLET_TXN_TYPE.REFERRAL_FRIEND,
      key: `referral-friend:${friendId}`,
      purchaseId: purchase._id,
      relatedUserId: buyer.referredBy,
    });
    if (referrer?.status === ACCOUNT_STATUS.ACTIVE) {
      await creditWallet({
        userId: buyer.referredBy,
        amountPaise: settings.referrerCreditPaise,
        type: WALLET_TXN_TYPE.REFERRAL_REFERRER,
        key: `referral-referrer:${friendId}`,
        purchaseId: purchase._id,
        relatedUserId: purchase.userId,
      });
    }
  } catch (err) {
    log.error(
      { err: err.message, purchaseId: String(purchase._id) },
      '[ReferralService] referral reward failed',
    );
  }
};

/**
 * Leader bonus check (pure, for tests).
 * @param {{ leaderId: string }} group
 * @param {{ userId: string }[]} completedPurchases
 * @param {number} minOthers
 * @returns {boolean}
 */
const qualifiesForLeaderBonus = (group, completedPurchases, minOthers) => {
  const leader = String(group.leaderId);
  const leaderBought = completedPurchases.some((p) => String(p.userId) === leader);
  const others = new Set(
    completedPurchases.map((p) => String(p.userId)).filter((id) => id !== leader),
  );
  return leaderBought && others.size >= minOthers;
};

/**
 * When a group completes: the leader bonus (REF-2), once per group. Never throws.
 * @param {string} groupId
 */
const onGroupCompleted = async (groupId) => {
  try {
    const flags = await getFeatureFlags();
    if (!flags.referrals) return;
    const group = await Group.findById(groupId).select('status leaderId').lean();
    if (!group || group.status !== GROUP_STATUS.COMPLETED || !group.leaderId) return;
    const [settings, purchases] = await Promise.all([
      getReferralSettings(),
      Purchase.find({ groupId, status: PURCHASE_STATUS.COMPLETED }).select('userId').lean(),
    ]);
    if (!qualifiesForLeaderBonus(group, purchases, settings.leaderBonusMinOtherPurchases)) return;
    await creditWallet({
      userId: group.leaderId,
      amountPaise: settings.leaderBonusPaise,
      type: WALLET_TXN_TYPE.LEADER_BONUS,
      key: `leader-bonus:${groupId}`,
      groupId,
    });
  } catch (err) {
    log.error(
      { err: err.message, groupId: String(groupId) },
      '[ReferralService] leader bonus failed',
    );
  }
};

module.exports = {
  referralLink,
  ensureReferralCode,
  getReferral,
  applyReferralCode,
  onPurchaseCompleted,
  qualifiesForLeaderBonus,
  onGroupCompleted,
};
