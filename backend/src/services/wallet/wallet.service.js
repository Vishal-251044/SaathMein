/**
 * Wallet credits (REF-3): SaathMein credits a user earns from referrals and the leader
 * bonus. Every change is one append-only WalletTransaction plus an atomic update of
 * `user.walletBalancePaise`, in one MongoDB transaction. Each reward has a unique key, so
 * it can never be paid twice. Credits are not cash and cannot be withdrawn.
 */
const User = require('../../models/user.model');
const WalletTransaction = require('../../models/walletTransaction.model');
const { createLogger } = require('../../utils/logger');
const { withTransaction } = require('../../utils/transaction');
const { formatINR } = require('../../utils/money');
const { getPagination, buildPaginationMeta } = require('../../helpers/genericFunctions');
const { notifyUsers } = require('../notifications/notification.service');
const { NOTIFICATION_TYPE } = require('../../constants/enums');

const log = createLogger('WalletService');

/**
 * Credit a user's wallet once per key.
 * @param {{ userId: string, amountPaise: number, type: string, key: string, groupId?: string,
 *   purchaseId?: string, relatedUserId?: string, note?: string }} credit
 * @returns {Promise<{ outcome: 'credited'|'already'|'skipped', balancePaise?: number }>}
 */
const creditWallet = async ({ userId, amountPaise, type, key, ...refs }) => {
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) return { outcome: 'skipped' };
  if (await WalletTransaction.exists({ key })) return { outcome: 'already' };
  try {
    const balancePaise = await withTransaction(async (session) => {
      const user = await User.findOneAndUpdate(
        { _id: userId },
        { $inc: { walletBalancePaise: amountPaise } },
        { new: true, session, projection: { walletBalancePaise: 1 } },
      );
      if (!user) throw new Error('USER_NOT_FOUND');
      // Unique key: a second credit for the same reward aborts the whole transaction
      await WalletTransaction.create(
        [{ userId, type, amountPaise, balanceAfterPaise: user.walletBalancePaise, key, ...refs }],
        { session },
      );
      return user.walletBalancePaise;
    });
    log.info({ userId: String(userId), type, amountPaise, key }, 'Wallet credited');
    await notifyUsers([userId], NOTIFICATION_TYPE.WALLET_CREDITED, {
      amount: formatINR(amountPaise),
      reason: type,
      url: '/wallet',
    }).catch(() => {});
    return { outcome: 'credited', balancePaise };
  } catch (err) {
    if (err?.code === 11000) return { outcome: 'already' };
    throw err;
  }
};

/** History row for the app. */
const toWalletRow = (txn) => ({
  id: String(txn._id),
  type: txn.type,
  amountPaise: txn.amountPaise,
  balanceAfterPaise: txn.balanceAfterPaise,
  groupId: txn.groupId ? String(txn.groupId) : null,
  createdAt: txn.createdAt,
});

/**
 * Balance and history.
 * @param {string} userId
 * @param {{ page?: string, limit?: string }} query
 */
const getWallet = async (userId, query = {}) => {
  const pagination = getPagination(query);
  const [user, rows, total] = await Promise.all([
    User.findById(userId).select('walletBalancePaise').lean(),
    WalletTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    WalletTransaction.countDocuments({ userId }),
  ]);
  return {
    balancePaise: user?.walletBalancePaise || 0,
    transactions: rows.map(toWalletRow),
    meta: buildPaginationMeta(total, pagination),
  };
};

module.exports = { creditWallet, getWallet };
