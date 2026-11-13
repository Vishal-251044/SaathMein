/**
 * Razorpay Route transfers (PAY-4). When an auction is won, each member's token minus
 * SaathMein's commission goes to the winning dealer's linked account ON HOLD. The hold is
 * released when that member's purchase is confirmed (Day 10); it is reversed when the
 * member exits or the dealer backs out (Days 9–10).
 * The token is a part-payment of the bill at the shop (decided 8 Nov 2026).
 * Each step is idempotent and writes the ledger in a transaction.
 */
const Payment = require('../../models/payment.model');
const Seller = require('../../models/seller.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { withTransaction } = require('../../utils/transaction');
const razorpay = require('./razorpay.service');
const { recordLedger } = require('./ledger.service');
const { committedRefundPaise } = require('./refund.service');
const { splitToken } = require('./commission');
const { raiseAlert } = require('../alerts/alert.service');
const { LEDGER_TYPE, PAYMENT_STATUS } = require('../../constants/enums');

const log = createLogger('RouteService');

/**
 * Create the held transfer for one member's token.
 * @param {string} paymentId - Paid token payment
 * @param {{ sellerId: string, pricePerUnitPaise: number, commissionRule: Object }} deal
 * @returns {Promise<{ outcome: 'created'|'already', transferPaise?: number, commissionPaise?: number, invoicedPaise?: number }>}
 * @throws {ApiError} 409 when the token was refunded or the dealer has no linked account
 */
const createHeldTransfer = async (paymentId, { sellerId, pricePerUnitPaise, commissionRule }) => {
  const payment = await Payment.findById(paymentId).lean();
  if (!payment) throw ApiError.notFound('Payment not found');
  // A failed or reversed transfer (dealer backed out) can be replaced by a new one
  if (payment.transfer && !['failed', 'reversed'].includes(payment.transfer.status)) {
    return { outcome: 'already' };
  }
  if (payment.status !== PAYMENT_STATUS.PAID || committedRefundPaise(payment) > 0) {
    throw ApiError.conflict('This token was refunded, so it cannot go to the dealer', {
      code: 'TOKEN_NOT_HELD',
    });
  }
  const seller = await Seller.findById(sellerId).select('razorpayAccountId').lean();
  if (!seller?.razorpayAccountId) {
    throw ApiError.conflict('The dealer has no Razorpay payout account', {
      code: 'PAYOUT_ACCOUNT_REQUIRED',
    });
  }

  const split = splitToken({
    tokenPaise: payment.amountPaise,
    pricePerUnitPaise,
    rule: commissionRule,
  });
  const result = await razorpay.createTransfer(payment.razorpayPaymentId, {
    accountId: seller.razorpayAccountId,
    amountPaise: split.transferPaise,
    notes: { paymentId: String(paymentId), groupId: String(payment.groupId) },
    onHold: true,
  });
  const transfer = result.items?.[0] ?? result;

  await withTransaction(async (session) => {
    await Payment.updateOne(
      { _id: paymentId },
      {
        $set: {
          status: PAYMENT_STATUS.TRANSFERRED,
          transfer: {
            razorpayTransferId: transfer.id,
            sellerId,
            razorpayAccountId: seller.razorpayAccountId,
            amountPaise: split.transferPaise,
            commissionPaise: split.fromTokenPaise,
            onHold: true,
            status: transfer.processed_at ? 'processed' : 'pending',
          },
        },
      },
      { session },
    );
    const base = {
      userId: payment.userId,
      sellerId,
      groupId: payment.groupId,
      paymentId: payment._id,
      ref: transfer.id,
    };
    await recordLedger(
      [
        { ...base, type: LEDGER_TYPE.TRANSFER, amountPaise: split.transferPaise, note: 'on_hold' },
        {
          ...base,
          type: LEDGER_TYPE.COMMISSION,
          amountPaise: split.fromTokenPaise,
          note: split.invoicedPaise ? `invoice_rest:${split.invoicedPaise}` : undefined,
        },
      ],
      session,
    );
  });
  log.info(
    { paymentId: String(paymentId), transferId: transfer.id, ...split },
    'Held transfer created',
  );
  return { outcome: 'created', ...split };
};

/**
 * Release the hold after the member's purchase is confirmed.
 * @param {string} paymentId - Payment with a held transfer
 * @returns {Promise<{ outcome: 'released'|'already' }>}
 */
const releaseHold = async (paymentId) => {
  const payment = await Payment.findById(paymentId).lean();
  const transfer = payment?.transfer;
  if (!transfer) throw ApiError.notFound('No transfer for this payment');
  if (transfer.status === 'released') return { outcome: 'already' };
  if (!['pending', 'processed'].includes(transfer.status)) {
    throw ApiError.conflict(`A ${transfer.status} transfer cannot be released`, {
      code: 'TRANSFER_NOT_HELD',
    });
  }

  await razorpay.releaseTransferHold(transfer.razorpayTransferId);
  await withTransaction(async (session) => {
    const updated = await Payment.updateOne(
      { _id: paymentId, 'transfer.status': { $in: ['pending', 'processed'] } },
      {
        $set: {
          'transfer.onHold': false,
          'transfer.status': 'released',
          'transfer.releasedAt': new Date(),
        },
      },
      { session },
    );
    if (!updated.modifiedCount) return;
    await recordLedger(
      [
        {
          type: LEDGER_TYPE.HOLD_RELEASE,
          amountPaise: transfer.amountPaise,
          userId: payment.userId,
          sellerId: transfer.sellerId,
          groupId: payment.groupId,
          paymentId: payment._id,
          ref: transfer.razorpayTransferId,
        },
      ],
      session,
    );
  });
  return { outcome: 'released' };
};

/**
 * Take a held transfer back (member exited or dealer backed out). SaathMein then holds the
 * whole token again, ready to refund or to move to the runner-up.
 * @param {string} paymentId - Payment with a transfer
 * @param {string} reason - Why (ledger note)
 * @returns {Promise<{ outcome: 'reversed'|'already' }>}
 */
const reverseHeldTransfer = async (paymentId, reason) => {
  const payment = await Payment.findById(paymentId).lean();
  const transfer = payment?.transfer;
  if (!transfer) throw ApiError.notFound('No transfer for this payment');
  if (transfer.status === 'reversed') return { outcome: 'already' };
  if (transfer.status === 'released') {
    throw ApiError.conflict('This transfer was already released to the dealer', {
      code: 'TRANSFER_RELEASED',
    });
  }

  await razorpay.reverseTransfer(transfer.razorpayTransferId, transfer.amountPaise);
  await withTransaction(async (session) => {
    const updated = await Payment.updateOne(
      { _id: paymentId, 'transfer.status': { $nin: ['reversed', 'released'] } },
      {
        $set: {
          status: PAYMENT_STATUS.PAID,
          'transfer.status': 'reversed',
          'transfer.onHold': false,
          'transfer.reversedAt': new Date(),
        },
      },
      { session },
    );
    if (!updated.modifiedCount) return;
    const base = {
      userId: payment.userId,
      sellerId: transfer.sellerId,
      groupId: payment.groupId,
      paymentId: payment._id,
      ref: transfer.razorpayTransferId,
      note: reason,
    };
    await recordLedger(
      [
        { ...base, type: LEDGER_TYPE.TRANSFER_REVERSAL, amountPaise: transfer.amountPaise },
        {
          ...base,
          type: LEDGER_TYPE.COMMISSION_REVERSAL,
          amountPaise: transfer.commissionPaise || 0,
        },
      ],
      session,
    );
  });
  log.info({ paymentId: String(paymentId), reason }, 'Transfer reversed');
  return { outcome: 'reversed' };
};

/**
 * transfer.processed / transfer.failed webhooks. A failed transfer never moved money, so
 * its ledger entries are reversed with new entries.
 * @param {Object} entity - Razorpay transfer entity
 * @param {boolean} failed - true for transfer.failed
 * @returns {Promise<boolean>} true when something changed
 */
const handleTransferEvent = async (entity, failed) => {
  if (!failed) {
    const result = await Payment.updateOne(
      { 'transfer.razorpayTransferId': entity.id, 'transfer.status': 'pending' },
      { $set: { 'transfer.status': 'processed' } },
    );
    return result.modifiedCount > 0;
  }
  return withTransaction(async (session) => {
    const payment = await Payment.findOneAndUpdate(
      {
        'transfer.razorpayTransferId': entity.id,
        'transfer.status': { $in: ['pending', 'processed'] },
      },
      {
        $set: {
          status: PAYMENT_STATUS.PAID,
          'transfer.status': 'failed',
          'transfer.lastError': entity.error?.description || 'transfer failed',
        },
      },
      { new: true, session },
    );
    if (!payment) return false;
    const base = {
      userId: payment.userId,
      sellerId: payment.transfer.sellerId,
      groupId: payment.groupId,
      paymentId: payment._id,
      ref: entity.id,
      note: 'transfer_failed',
    };
    await recordLedger(
      [
        { ...base, type: LEDGER_TYPE.TRANSFER_REVERSAL, amountPaise: payment.transfer.amountPaise },
        {
          ...base,
          type: LEDGER_TYPE.COMMISSION_REVERSAL,
          amountPaise: payment.transfer.commissionPaise || 0,
        },
      ],
      session,
    );
    // Finance sees it on the Payment monitor (after the transaction)
    setImmediate(() =>
      raiseAlert({
        type: 'payment',
        severity: 'critical',
        title: 'Route transfer to a dealer failed',
        message: entity.error?.description || 'Razorpay reported the transfer failed.',
        subjectType: 'payment',
        subjectId: String(payment._id),
        dedupeKey: `transfer:failed:${entity.id}`,
      }),
    );
    log.error(
      { paymentId: String(payment._id), transferId: entity.id },
      '[RouteService] transfer failed',
    );
    return true;
  });
};

module.exports = { createHeldTransfer, releaseHold, reverseHeldTransfer, handleTransferEvent };
