/**
 * Refunds (PAY-3) — automatic for: leaving an open group, leaving after seats lock (minus
 * the back-out fee), group expired, no_deal, cancelled, a payment that arrived after the
 * last seat was taken, and (later) admin refunds and disputes.
 *
 * Exactly once: a refund entry is CLAIMED in the payment document (atomic, one per reason)
 * before Razorpay is called, so retries and duplicate jobs can never refund twice.
 * The ledger `refund` (+ `fee`) entries are written when Razorpay reports the refund as
 * processed (API answer or refund.processed webhook), so the ledger matches Razorpay.
 */
const Payment = require('../../models/payment.model');
const GroupMember = require('../../models/groupMember.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { withTransaction } = require('../../utils/transaction');
const { enqueueRefund } = require('../../jobs/queues');
const razorpay = require('./razorpay.service');
const { recordLedger } = require('./ledger.service');
const { notifyUsers } = require('../notifications/notification.service');
const { formatINR } = require('../../utils/money');
const {
  LEDGER_TYPE,
  MEMBER_STATUS,
  NOTIFICATION_TYPE,
  PAYMENT_STATUS,
} = require('../../constants/enums');

const log = createLogger('RefundService');
const MAX_ATTEMPTS = 8;
const REFUNDABLE = [PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_REFUNDED];
const LIVE_REFUND = ['pending', 'processed'];

/** Refund reasons (stored on the refund entry and in the ledger note). */
const REFUND_REASON = Object.freeze({
  LEFT_OPEN_GROUP: 'left_open_group',
  LEFT_AFTER_LOCK: 'left_after_lock',
  GROUP_EXPIRED: 'group_expired',
  NO_DEAL: 'no_deal',
  GROUP_CANCELLED: 'group_cancelled',
  SEAT_UNAVAILABLE: 'seat_unavailable',
  AMOUNT_MISMATCH: 'amount_mismatch',
});

/**
 * Amount already refunded or being refunded (paise), plus fees kept.
 * @param {Object} payment - Payment
 * @returns {number}
 */
const committedRefundPaise = (payment) =>
  (payment.refunds || [])
    .filter((refund) => LIVE_REFUND.includes(refund.status))
    .reduce((sum, refund) => sum + refund.amountPaise + (refund.feePaise || 0), 0);

/**
 * Payment status after its refunds.
 * @param {Object} payment - Payment with refunds
 * @returns {string}
 */
const statusAfterRefunds = (payment) => {
  const refunded = (payment.refunds || [])
    .filter((refund) => LIVE_REFUND.includes(refund.status))
    .reduce((sum, refund) => sum + refund.amountPaise, 0);
  return refunded >= payment.amountPaise
    ? PAYMENT_STATUS.REFUNDED
    : PAYMENT_STATUS.PARTIALLY_REFUNDED;
};

/**
 * Claim a refund entry for `reason` (or re-open a failed one). Returns null when a refund
 * for this reason is already pending or processed.
 * @returns {Promise<{ payment: Object, refund: Object }|null>}
 */
const claimRefund = async (paymentId, { reason, amountPaise, feePaise, initiatedBy }) => {
  // Retry of a failed refund for the same reason
  const reopened = await Payment.findOneAndUpdate(
    { _id: paymentId, refunds: { $elemMatch: { reason, status: 'failed' } } },
    {
      $set: { 'refunds.$.status': 'pending', 'refunds.$.lastError': null },
      $inc: { 'refunds.$.attempts': 1 },
    },
    { new: true },
  );
  if (reopened)
    return { payment: reopened, refund: reopened.refunds.find((r) => r.reason === reason) };

  const claimed = await Payment.findOneAndUpdate(
    {
      _id: paymentId,
      status: { $in: REFUNDABLE },
      refunds: { $not: { $elemMatch: { reason, status: { $in: LIVE_REFUND } } } },
    },
    {
      $push: {
        refunds: { reason, amountPaise, feePaise, initiatedBy, status: 'pending', attempts: 1 },
      },
    },
    { new: true },
  );
  if (!claimed) return null;
  return { payment: claimed, refund: claimed.refunds.at(-1) };
};

/**
 * Write the ledger for a processed refund exactly once (pending → processed flip).
 * @param {string} razorpayRefundId - rfnd_...
 * @param {Date} [processedAt] - When Razorpay processed it
 * @returns {Promise<boolean>} true when this call recorded it
 */
const markRefundProcessed = async (razorpayRefundId, processedAt = new Date()) => {
  const done = await withTransaction(async (session) => {
    const payment = await Payment.findOneAndUpdate(
      { refunds: { $elemMatch: { razorpayRefundId, status: { $ne: 'processed' } } } },
      { $set: { 'refunds.$.status': 'processed', 'refunds.$.processedAt': processedAt } },
      { new: true, session },
    );
    if (!payment) return null;
    const refund = payment.refunds.find((item) => item.razorpayRefundId === razorpayRefundId);
    payment.status = statusAfterRefunds(payment);
    await payment.save({ session });

    const base = { userId: payment.userId, groupId: payment.groupId, paymentId: payment._id };
    await recordLedger(
      [
        {
          ...base,
          type: LEDGER_TYPE.REFUND,
          amountPaise: refund.amountPaise,
          ref: razorpayRefundId,
          note: refund.reason,
        },
        {
          ...base,
          type: LEDGER_TYPE.FEE,
          amountPaise: refund.feePaise || 0,
          ref: razorpayRefundId,
          note: `backout_fee:${refund.reason}`,
        },
      ],
      session,
    );
    log.info(
      { paymentId: String(payment._id), razorpayRefundId, amountPaise: refund.amountPaise },
      'Refund processed',
    );
    return { userId: payment.userId, groupId: payment.groupId, amountPaise: refund.amountPaise };
  });
  if (!done) return false;

  // After commit: tell the buyer (LIV-3 "refund done")
  if (done.amountPaise > 0) {
    await notifyUsers([done.userId], NOTIFICATION_TYPE.REFUND_DONE, {
      amount: formatINR(done.amountPaise),
      groupId: done.groupId,
      url: `/group/${done.groupId}`,
    });
  }
  return true;
};

/**
 * Mark a refund failed (refund.failed webhook) so the retry sweep picks it up.
 * @param {string} razorpayRefundId - rfnd_...
 * @param {string} [error] - Razorpay's reason
 * @returns {Promise<boolean>}
 */
const markRefundFailed = async (razorpayRefundId, error = 'Refund failed at Razorpay') => {
  const result = await Payment.updateOne(
    { refunds: { $elemMatch: { razorpayRefundId, status: 'pending' } } },
    { $set: { 'refunds.$.status': 'failed', 'refunds.$.lastError': error } },
  );
  // TODO(Day 13): alert Finance on the Payment monitor
  log.error({ razorpayRefundId, error }, '[RefundService] refund failed at Razorpay — will retry');
  return result.modifiedCount > 0;
};

/**
 * Refund a payment now (called by the refund job, or inline without Redis).
 * Default amount: everything not yet refunded, minus `feePaise`.
 * @param {string} paymentId - Our payment id
 * @param {{ reason: string, amountPaise?: number, feePaise?: number, initiatedBy?: string }} options
 * @returns {Promise<{ outcome: 'refunded'|'pending'|'already'|'nothing_to_refund' }>}
 * @throws {ApiError} When Razorpay refuses (the job retries; the entry is marked failed)
 */
const refundPayment = async (
  paymentId,
  { reason, amountPaise, feePaise = 0, initiatedBy } = {},
) => {
  const payment = await Payment.findById(paymentId).lean();
  if (!payment) throw ApiError.notFound(`Payment not found: ${paymentId}`);
  if (!payment.razorpayPaymentId || !REFUNDABLE.includes(payment.status)) {
    return { outcome: 'nothing_to_refund' };
  }

  const remaining = payment.amountPaise - committedRefundPaise(payment);
  const fee = Math.min(feePaise, remaining);
  const amount = Math.min(amountPaise ?? remaining - fee, remaining - fee);
  if (amount <= 0 && fee <= 0) return { outcome: 'nothing_to_refund' };

  const claim = await claimRefund(paymentId, {
    reason,
    amountPaise: amount,
    feePaise: fee,
    initiatedBy,
  });
  if (!claim) return { outcome: 'already' };
  const { refund } = claim;
  if (refund.attempts > MAX_ATTEMPTS) {
    log.error(
      { paymentId, reason },
      '[RefundService] refund gave up after max attempts — needs Finance',
    );
  }

  // A fee-only "refund" (whole token kept) needs no Razorpay call
  if (refund.amountPaise === 0) {
    await withTransaction(async (session) => {
      await Payment.updateOne(
        { _id: paymentId, 'refunds._id': refund._id },
        { $set: { 'refunds.$.status': 'processed', 'refunds.$.processedAt': new Date() } },
        { session },
      );
      await recordLedger(
        [
          {
            type: LEDGER_TYPE.FEE,
            amountPaise: refund.feePaise,
            userId: payment.userId,
            groupId: payment.groupId,
            paymentId: payment._id,
            note: `backout_fee:${reason}`,
          },
        ],
        session,
      );
    });
    return { outcome: 'refunded' };
  }

  let result;
  try {
    result = await razorpay.createRefund(payment.razorpayPaymentId, {
      amountPaise: refund.amountPaise,
      receipt: `rf_${refund._id}`, // same receipt on retry
      notes: { paymentId: String(paymentId), reason },
    });
  } catch (err) {
    await Payment.updateOne(
      { _id: paymentId, 'refunds._id': refund._id },
      { $set: { 'refunds.$.status': 'failed', 'refunds.$.lastError': err.message } },
    );
    throw err;
  }

  await Payment.updateOne(
    { _id: paymentId, 'refunds._id': refund._id },
    { $set: { 'refunds.$.razorpayRefundId': result.id } },
  );
  if (result.status === 'processed') {
    await markRefundProcessed(result.id, new Date((result.created_at || Date.now() / 1000) * 1000));
    return { outcome: 'refunded' };
  }
  log.info(
    { paymentId, reason, razorpayRefundId: result.id },
    'Refund created, waiting for Razorpay',
  );
  return { outcome: 'pending' };
};

/**
 * Queue a refund (retried by the worker); without Redis, refund inline and log failures —
 * the retry sweep tries again later.
 * @param {string} paymentId - Payment id
 * @param {{ reason: string, amountPaise?: number, feePaise?: number, attempt?: number }} options
 * @returns {Promise<void>}
 */
const queueRefund = async (paymentId, options) => {
  const queued = await enqueueRefund({ paymentId: String(paymentId), ...options }).catch((err) => {
    log.error({ err: err.message, paymentId: String(paymentId) }, 'Could not queue refund');
    return false;
  });
  if (queued) return;
  try {
    const { attempt: _attempt, ...refund } = options;
    await refundPayment(paymentId, refund);
  } catch (err) {
    log.error(
      { err: err.message, paymentId: String(paymentId) },
      '[RefundService] inline refund failed',
    );
  }
};

/**
 * Refund every paid member of a group that ended (expired / no_deal / cancelled).
 * Members become `refunded`.
 * @param {string} groupId - Group id
 * @param {string} reason - REFUND_REASON value
 * @returns {Promise<number>} Refunds queued
 */
const refundGroupMembers = async (groupId, reason) => {
  const payments = await Payment.find({ groupId, status: { $in: REFUNDABLE } })
    .select('_id userId')
    .lean();
  await GroupMember.updateMany(
    { groupId, status: { $in: [MEMBER_STATUS.ACTIVE, MEMBER_STATUS.ACCEPTED] } },
    { $set: { status: MEMBER_STATUS.REFUNDED, leftAt: new Date() } },
  );
  await GroupMember.updateMany(
    {
      groupId,
      status: {
        $in: [MEMBER_STATUS.WAITLISTED, MEMBER_STATUS.PENDING_APPROVAL, MEMBER_STATUS.APPROVED],
      },
    },
    { $set: { status: MEMBER_STATUS.LEFT, leftAt: new Date() }, $unset: { offerExpiresAt: 1 } },
  );
  for (const payment of payments) {
    await queueRefund(payment._id, { reason });
  }
  log.info({ groupId: String(groupId), reason, count: payments.length }, 'Group refunds queued');
  return payments.length;
};

/**
 * Safety net (minute sweep): queue failed refunds again, up to the attempt limit.
 * @returns {Promise<number>} Refunds re-queued
 */
const retryFailedRefunds = async () => {
  const payments = await Payment.find({
    refunds: { $elemMatch: { status: 'failed', attempts: { $lt: MAX_ATTEMPTS } } },
  })
    .select('_id refunds')
    .limit(50)
    .lean();
  let queued = 0;
  for (const payment of payments) {
    for (const refund of payment.refunds.filter(
      (r) => r.status === 'failed' && r.attempts < MAX_ATTEMPTS,
    )) {
      await queueRefund(payment._id, {
        reason: refund.reason,
        amountPaise: refund.amountPaise,
        feePaise: refund.feePaise,
        attempt: refund.attempts + 1,
      });
      queued += 1;
    }
  }
  return queued;
};

module.exports = {
  REFUND_REASON,
  committedRefundPaise,
  statusAfterRefunds,
  refundPayment,
  queueRefund,
  refundGroupMembers,
  retryFailedRefunds,
  markRefundProcessed,
  markRefundFailed,
};
