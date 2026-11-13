/**
 * Staff actions from the monitors (PRD §10.11, MON-3). Every action needs a reason note;
 * controllers write it to the audit log with before / after.
 * - Auctions: pause, resume, extend, cancel (all tokens refunded), force runner-up.
 * - Groups: extend the deadline, cancel (all tokens refunded).
 * - Payments: retry a failed refund, manual refund, release or reverse a dealer hold.
 * - Dealers: warn, suspend from auctions, lift a penalty.
 * - Buyers: suspend (sessions ended) and reactivate.
 */
const Group = require('../../models/group.model');
const Payment = require('../../models/payment.model');
const Seller = require('../../models/seller.model');
const User = require('../../models/user.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { transition } = require('../groups/stateMachine');
const { publishGroupStatus } = require('../groups/groupLive');
const { scheduleAuctionClose } = require('../../jobs/queues');
const { emitToStaff } = require('../../sockets/emitter');
const { queueRefund, committedRefundPaise } = require('../payments/refund.service');
const { releaseHold, reverseHeldTransfer } = require('../payments/route.service');
const { applyPenalties } = require('../trust/penalty.service');
const { recomputeSellerRating } = require('../trust/rating.service');
const { revokeUserSessions } = require('../auth/session.service');
const { ACCOUNT_STATUS, GROUP_STATUS, PAYMENT_STATUS } = require('../../constants/enums');

const log = createLogger('StaffActions');
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const LIVE_TRANSFER = ['pending', 'processed'];
const ENDABLE = [
  GROUP_STATUS.OPEN,
  GROUP_STATUS.FULL,
  GROUP_STATUS.AUCTION_LIVE,
  GROUP_STATUS.WON,
  GROUP_STATUS.RUNNER_UP,
];

/** Short snapshot for the audit log. */
const groupSnapshot = (group) => ({
  status: group.status,
  deadline: group.deadline,
  endsAt: group.auction?.endsAt || null,
  pausedAt: group.auction?.pausedAt || null,
});

/** Live-auction group or 409. */
const loadLiveAuction = async (groupId) => {
  const group = await Group.findById(groupId);
  if (!group) throw ApiError.notFound('Group not found');
  if (group.status !== GROUP_STATUS.AUCTION_LIVE || group.auction?.closedAt) {
    throw ApiError.conflict('This auction is not running', { code: 'AUCTION_NOT_LIVE' });
  }
  return group;
};

const changed = (groupId) =>
  emitToStaff('monitor:changed', { scope: 'auction', groupId: String(groupId) });

/* --------------------------------- Auctions --------------------------------- */

/** Pause bidding (bids refused, close job waits). */
const pauseAuction = async (groupId, now = new Date()) => {
  const group = await loadLiveAuction(groupId);
  if (group.auction.pausedAt)
    throw ApiError.conflict('The auction is already paused', { code: 'ALREADY_PAUSED' });
  const before = groupSnapshot(group);
  const updated = await Group.findOneAndUpdate(
    { _id: groupId, status: GROUP_STATUS.AUCTION_LIVE, 'auction.pausedAt': { $exists: false } },
    { $set: { 'auction.pausedAt': now } },
    { new: true },
  );
  publishGroupStatus(updated);
  changed(groupId);
  return { before, after: groupSnapshot(updated) };
};

/** Resume: the paused time is added to the end time, so dealers lose nothing. */
const resumeAuction = async (groupId, now = new Date()) => {
  const group = await loadLiveAuction(groupId);
  if (!group.auction.pausedAt)
    throw ApiError.conflict('The auction is not paused', { code: 'NOT_PAUSED' });
  const before = groupSnapshot(group);
  const pausedMs = Math.max(0, now.getTime() - new Date(group.auction.pausedAt).getTime());
  const updated = await Group.findOneAndUpdate(
    { _id: groupId, status: GROUP_STATUS.AUCTION_LIVE, 'auction.pausedAt': group.auction.pausedAt },
    {
      $set: { 'auction.endsAt': new Date(new Date(group.auction.endsAt).getTime() + pausedMs) },
      $unset: { 'auction.pausedAt': 1 },
    },
    { new: true },
  );
  await scheduleAuctionClose(updated);
  publishGroupStatus(updated);
  changed(groupId);
  return { before, after: groupSnapshot(updated) };
};

/** Extend a live auction by N hours. */
const extendAuction = async (groupId, hours) => {
  const group = await loadLiveAuction(groupId);
  const before = groupSnapshot(group);
  const updated = await Group.findOneAndUpdate(
    { _id: groupId, status: GROUP_STATUS.AUCTION_LIVE, 'auction.endsAt': group.auction.endsAt },
    {
      $set: {
        'auction.endsAt': new Date(new Date(group.auction.endsAt).getTime() + hours * HOUR_MS),
      },
    },
    { new: true },
  );
  if (!updated)
    throw ApiError.conflict('The auction changed a moment ago. Please refresh.', {
      code: 'GROUP_CHANGED',
    });
  await scheduleAuctionClose(updated);
  publishGroupStatus(updated);
  changed(groupId);
  return { before, after: groupSnapshot(updated) };
};

/**
 * Cancel a group or auction: the state machine refunds every token (and takes back held
 * transfers first).
 */
const cancelGroup = async (groupId, staffId) => {
  const group = await Group.findById(groupId);
  if (!group) throw ApiError.notFound('Group not found');
  if (!ENDABLE.includes(group.status)) {
    throw ApiError.conflict('This group can no longer be cancelled', { code: 'CANNOT_CANCEL' });
  }
  const before = groupSnapshot(group);
  const updated = await transition(group, GROUP_STATUS.CANCELLED, {
    reason: 'cancelled_by_staff',
    actor: { type: 'staff', id: staffId }, // the reason note itself goes to the audit log
  });
  changed(groupId);
  log.warn({ groupId, staffId }, 'Group cancelled by staff');
  return { before, after: groupSnapshot(updated) };
};

/**
 * Force runner-up: take the group from the winner and offer it to the next best dealer
 * (or cancel with refunds when there is none). Penalising the winner is optional.
 */
const forceRunnerUp = async (groupId, staffId, reason, penalise) => {
  const group = await Group.findById(groupId);
  if (!group) throw ApiError.notFound('Group not found');
  if (group.status !== GROUP_STATUS.WON) {
    throw ApiError.conflict('Only a won group (before any purchase) can go to the runner-up', {
      code: 'CANNOT_FORCE_RUNNER_UP',
    });
  }
  const before = groupSnapshot(group);
  const { handOverToRunnerUp } = require('../auction/winner.service');
  const updated = await handOverToRunnerUp(group, {
    sellerId: String(group.sellerId),
    actorId: staffId,
    actorType: 'staff',
    reason: `Staff: ${reason}`,
    penalise,
  });
  changed(groupId);
  return { before, after: groupSnapshot(updated) };
};

/** Extend an open group's deadline by N days (not a status change). */
const extendGroupDeadline = async (groupId, days) => {
  const group = await Group.findById(groupId).lean();
  if (!group) throw ApiError.notFound('Group not found');
  if (group.status !== GROUP_STATUS.OPEN)
    throw ApiError.conflict('Only open groups have a deadline to extend', {
      code: 'GROUP_NOT_OPEN',
    });
  const deadline = new Date(new Date(group.deadline).getTime() + days * DAY_MS);
  await Group.updateOne(
    { _id: groupId, status: GROUP_STATUS.OPEN },
    { $set: { deadline }, $unset: { leaderDecisionDueAt: 1 } },
  );
  changed(groupId);
  return { before: { deadline: group.deadline }, after: { deadline } };
};

/* --------------------------------- Payments --------------------------------- */

/** Payment snapshot for the audit log. */
const paymentSnapshot = (payment) => ({
  status: payment.status,
  refunds: (payment.refunds || []).map((refund) => ({
    reason: refund.reason,
    status: refund.status,
    amountPaise: refund.amountPaise,
  })),
  transferStatus: payment.transfer?.status || null,
});

/** Retry a failed refund now. */
const retryRefund = async (paymentId) => {
  const payment = await Payment.findById(paymentId).lean();
  if (!payment) throw ApiError.notFound('Payment not found');
  const failed = (payment.refunds || []).find((refund) => refund.status === 'failed');
  if (!failed)
    throw ApiError.conflict('This payment has no failed refund', { code: 'NO_FAILED_REFUND' });
  await queueRefund(paymentId, {
    reason: failed.reason,
    amountPaise: failed.amountPaise,
    feePaise: failed.feePaise || 0,
  });
  return {
    before: paymentSnapshot(payment),
    after: paymentSnapshot((await Payment.findById(paymentId).lean()) || payment),
  };
};

/**
 * Manual refund by Finance (PRD Payments: "refunds (manual with reason)"). Tokens held
 * at a dealer must be taken back first (reverse the hold).
 * @param {string} paymentId
 * @param {number} amountPaise - Up to what is still refundable
 * @param {string} staffId
 */
const manualRefund = async (paymentId, amountPaise, staffId) => {
  const payment = await Payment.findById(paymentId).lean();
  if (!payment) throw ApiError.notFound('Payment not found');
  if (
    payment.status === PAYMENT_STATUS.TRANSFERRED &&
    LIVE_TRANSFER.includes(payment.transfer?.status)
  ) {
    throw ApiError.conflict('This token is on hold at the dealer. Reverse the hold first.', {
      code: 'REVERSE_HOLD_FIRST',
    });
  }
  if (![PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_REFUNDED].includes(payment.status)) {
    throw ApiError.conflict('This payment cannot be refunded', { code: 'NOT_REFUNDABLE' });
  }
  const remaining = payment.amountPaise - committedRefundPaise(payment);
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0 || amountPaise > remaining) {
    throw new ApiError(
      422,
      `Refund between ₹0.01 and the ${remaining / 100} rupees still refundable`,
      { code: 'INVALID_REFUND_AMOUNT' },
    );
  }
  // Refunds are unique per reason: number each manual refund, so a double click claims the
  // same reason once while a later, deliberate second refund still goes through.
  const manualCount = (payment.refunds || []).filter((refund) =>
    refund.reason.startsWith('manual_refund'),
  ).length;
  await queueRefund(paymentId, {
    reason: `manual_refund_${manualCount + 1}`,
    amountPaise,
    feePaise: 0,
    initiatedBy: staffId,
  });
  log.warn({ paymentId, amountPaise, staffId }, 'Manual refund queued');
  return {
    before: paymentSnapshot(payment),
    after: paymentSnapshot((await Payment.findById(paymentId).lean()) || payment),
  };
};

/** Release a dealer hold (e.g. purchase confirmed outside the app). */
const releasePaymentHold = async (paymentId) => {
  const payment = await Payment.findById(paymentId).lean();
  if (!payment) throw ApiError.notFound('Payment not found');
  await releaseHold(paymentId);
  return {
    before: paymentSnapshot(payment),
    after: paymentSnapshot(await Payment.findById(paymentId).lean()),
  };
};

/** Take a held transfer back from the dealer (money returns to SaathMein). */
const reversePaymentHold = async (paymentId, reason) => {
  const payment = await Payment.findById(paymentId).lean();
  if (!payment) throw ApiError.notFound('Payment not found');
  await reverseHeldTransfer(paymentId, `staff:${reason}`);
  return {
    before: paymentSnapshot(payment),
    after: paymentSnapshot(await Payment.findById(paymentId).lean()),
  };
};

/* ------------------------------ Dealers / buyers ----------------------------- */

/** Warn a dealer, or suspend them from auctions for N days. */
const penaliseDealer = async (sellerId, type, { reason, staffId, days }) => {
  if (!(await Seller.exists({ _id: sellerId }))) throw ApiError.notFound('Dealer not found');
  await applyPenalties(sellerId, [type], {
    reason: `Staff: ${reason}`,
    staffId,
    suspensionDays: days,
  });
  return { before: null, after: { type, days: days || null } };
};

/**
 * Lift a penalty early (suspension ends now; a lifted rating penalty no longer counts).
 * The penalty row stays for history.
 */
const liftPenalty = async (sellerId, penaltyId, { reason, staffId, now = new Date() }) => {
  const seller = await Seller.findOne({ _id: sellerId, 'penalties._id': penaltyId })
    .select('penalties')
    .lean();
  const penalty = seller?.penalties.find((item) => String(item._id) === String(penaltyId));
  if (!penalty) throw ApiError.notFound('Penalty not found');
  if (penalty.liftedAt)
    throw ApiError.conflict('This penalty was already lifted', { code: 'ALREADY_LIFTED' });
  await Seller.updateOne(
    { _id: sellerId, 'penalties._id': penaltyId },
    {
      $set: {
        'penalties.$.liftedAt': now,
        'penalties.$.liftedBy': staffId,
        'penalties.$.liftReason': reason,
      },
    },
  );
  if (penalty.type === 'rating_penalty') await recomputeSellerRating(sellerId);
  return { before: { type: penalty.type, until: penalty.until || null }, after: { liftedAt: now } };
};

/** Suspend or reactivate a buyer account (never a staff account). */
const setBuyerStatus = async (userId, active) => {
  const user = await User.findById(userId).select('status staffRole').lean();
  if (!user) throw ApiError.notFound('User not found');
  if (user.staffRole) throw ApiError.forbidden('Use Team to manage staff accounts');
  const status = active ? ACCOUNT_STATUS.ACTIVE : ACCOUNT_STATUS.SUSPENDED;
  await User.updateOne({ _id: userId }, { $set: { status } });
  if (!active) await revokeUserSessions(userId, 'suspended');
  return { before: { status: user.status }, after: { status } };
};

module.exports = {
  pauseAuction,
  resumeAuction,
  extendAuction,
  cancelGroup,
  forceRunnerUp,
  extendGroupDeadline,
  retryRefund,
  manualRefund,
  releasePaymentHold,
  reversePaymentHold,
  penaliseDealer,
  liftPenalty,
  setBuyerStatus,
};
