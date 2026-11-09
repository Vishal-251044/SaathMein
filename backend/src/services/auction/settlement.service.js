/**
 * Token settlement after a win (PAY-4, decided 8 Nov 2026: the token is part-payment).
 * - Group won (auction, runner-up or seller-led deal) or a freed seat taken after a win →
 *   each seated member's token minus SaathMein's commission goes to the dealer's Razorpay
 *   linked account ON HOLD (released on purchase confirmation, Day 10).
 * - Dealer backs out / group ends without a sale → held transfers are reversed first, so
 *   the tokens can be refunded or moved to the runner-up.
 * Every step is idempotent (route.service); failures are logged and retried by the minute
 * sweep, never thrown into the caller (the status change already happened).
 */
const Group = require('../../models/group.model');
const GroupMember = require('../../models/groupMember.model');
const Payment = require('../../models/payment.model');
const Category = require('../../models/category.model');
const { createLogger } = require('../../utils/logger');
const { createHeldTransfer, reverseHeldTransfer } = require('../payments/route.service');
const { GROUP_STATUS, MEMBER_STATUS, PAYMENT_STATUS } = require('../../constants/enums');

const log = createLogger('Settlement');

/** Groups whose tokens belong with the winning dealer. */
const SETTLED_STATUSES = [GROUP_STATUS.WON, GROUP_STATUS.PURCHASING];
/** Transfer states that still hold money at the dealer (not yet released or reversed). */
const LIVE_TRANSFER = ['pending', 'processed'];

/**
 * Create the missing held transfers for a won group.
 * @param {string} groupId - Group in won / purchasing
 * @returns {Promise<{ created: number, failed: number }>}
 */
const holdGroupTransfers = async (groupId) => {
  const group = await Group.findById(groupId)
    .select('status sellerId winningPricePaise categoryId')
    .lean();
  if (!group || !SETTLED_STATUSES.includes(group.status) || !group.sellerId) {
    return { created: 0, failed: 0 };
  }
  const [category, members] = await Promise.all([
    Category.findById(group.categoryId).select('commission').lean(),
    GroupMember.find({ groupId, status: MEMBER_STATUS.ACTIVE, paymentId: { $exists: true } })
      .select('paymentId')
      .lean(),
  ]);
  // Tokens still held by SaathMein (no live transfer yet)
  const payments = await Payment.find({
    _id: { $in: members.map((member) => member.paymentId) },
    status: PAYMENT_STATUS.PAID,
  })
    .select('_id')
    .lean();

  let created = 0;
  let failed = 0;
  for (const payment of payments) {
    try {
      const { outcome } = await createHeldTransfer(payment._id, {
        sellerId: group.sellerId,
        pricePerUnitPaise: group.winningPricePaise,
        commissionRule: category?.commission,
      });
      if (outcome === 'created') created += 1;
    } catch (err) {
      failed += 1;
      log.warn(
        {
          err: err.message,
          code: err.code,
          groupId: String(groupId),
          paymentId: String(payment._id),
        },
        '[Settlement] held transfer not created (will retry)',
      );
    }
  }
  if (created || failed) log.info({ groupId: String(groupId), created, failed }, 'Held transfers');
  return { created, failed };
};

/**
 * Reverse every live held transfer of a group (dealer backed out, group ended).
 * @param {string} groupId - Group
 * @param {string} reason - Ledger note
 * @returns {Promise<{ reversed: number, failed: number }>}
 */
const reverseGroupTransfers = async (groupId, reason) => {
  const payments = await Payment.find({
    groupId,
    status: PAYMENT_STATUS.TRANSFERRED,
    'transfer.status': { $in: LIVE_TRANSFER },
  })
    .select('_id')
    .lean();
  let reversed = 0;
  let failed = 0;
  for (const payment of payments) {
    try {
      const { outcome } = await reverseHeldTransfer(payment._id, reason);
      if (outcome === 'reversed') reversed += 1;
    } catch (err) {
      failed += 1;
      log.error(
        { err: err.message, groupId: String(groupId), paymentId: String(payment._id) },
        '[Settlement] transfer reversal failed',
      );
    }
  }
  return { reversed, failed };
};

/**
 * Never throws: for effects that run after a status change.
 * @param {string} groupId
 * @returns {Promise<void>}
 */
const holdGroupTransfersSafe = (groupId) =>
  holdGroupTransfers(groupId).catch((err) =>
    log.error({ err: err.message, groupId: String(groupId) }, '[Settlement] hold failed'),
  );

/**
 * Minute sweep: create held transfers that failed earlier (Razorpay down, dealer account
 * not ready) for won / purchasing groups.
 * @returns {Promise<number>} Transfers created
 */
const retryMissingHolds = async () => {
  const groups = await Group.find({ status: { $in: SETTLED_STATUSES } })
    .select('_id')
    .limit(500)
    .lean();
  if (!groups.length) return 0;
  const seated = await GroupMember.find({
    groupId: { $in: groups.map((group) => group._id) },
    status: MEMBER_STATUS.ACTIVE,
    paymentId: { $exists: true },
  })
    .select('paymentId')
    .lean();
  const pendingGroups = await Payment.distinct('groupId', {
    _id: { $in: seated.map((member) => member.paymentId) },
    status: PAYMENT_STATUS.PAID,
  });
  let created = 0;
  for (const groupId of pendingGroups.slice(0, 20)) {
    created += (await holdGroupTransfers(groupId)).created;
  }
  return created;
};

module.exports = {
  holdGroupTransfers,
  holdGroupTransfersSafe,
  reverseGroupTransfers,
  retryMissingHolds,
};
