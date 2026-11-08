/**
 * Buyer payment history and money timeline per group (PAY-6): paid → held → refunded /
 * part kept as back-out fee / sent to the dealer on hold → released. Receipts show the
 * Razorpay payment id, method and time. Never shows card or UPI details (we have none).
 */
const Payment = require('../../models/payment.model');
const { getPagination, buildPaginationMeta } = require('../../helpers/genericFunctions');
const { PAYMENT_STATUS } = require('../../constants/enums');

/** Statuses a buyer sees (open checkouts are left out). */
const VISIBLE = [
  PAYMENT_STATUS.PAID,
  PAYMENT_STATUS.REFUNDED,
  PAYMENT_STATUS.PARTIALLY_REFUNDED,
  PAYMENT_STATUS.TRANSFERRED,
  PAYMENT_STATUS.FAILED,
];

/**
 * Timeline events for one payment, oldest first.
 * @param {Object} payment - Lean payment
 * @returns {Object[]} `{ type, amountPaise, at, status? }`
 */
const moneyTimeline = (payment) => {
  if (payment.status === PAYMENT_STATUS.FAILED) {
    return [{ type: 'failed', amountPaise: payment.amountPaise, at: payment.updatedAt }];
  }
  const events = [{ type: 'paid', amountPaise: payment.amountPaise, at: payment.paidAt }];
  const transfer = payment.transfer;
  const isHeld = !(payment.refunds || []).some((r) => r.status !== 'failed') && !transfer;
  if (isHeld) events.push({ type: 'held', amountPaise: payment.amountPaise, at: payment.paidAt });

  for (const refund of payment.refunds || []) {
    if (refund.feePaise) {
      events.push({
        type: 'fee_kept',
        amountPaise: refund.feePaise,
        at: refund.createdAt,
        reason: refund.reason,
      });
    }
    if (refund.amountPaise) {
      events.push({
        type: refund.status === 'processed' ? 'refunded' : 'refund_started',
        amountPaise: refund.amountPaise,
        at: refund.processedAt || refund.createdAt,
        reason: refund.reason,
        status: refund.status,
      });
    }
  }
  if (transfer && transfer.status !== 'failed') {
    // The buyer sees the whole token going towards their bill (part-payment)
    events.push({
      type: 'sent_to_dealer',
      amountPaise: payment.amountPaise,
      at: payment.updatedAt,
      status: transfer.status,
    });
    if (transfer.status === 'released') {
      events.push({ type: 'released', amountPaise: payment.amountPaise, at: transfer.releasedAt });
    }
    if (transfer.status === 'reversed') {
      events.push({
        type: 'returned_from_dealer',
        amountPaise: payment.amountPaise,
        at: transfer.reversedAt,
      });
    }
  }
  return events.filter((event) => event.at).sort((a, b) => new Date(a.at) - new Date(b.at));
};

/**
 * Buyer's view of one payment (receipt + timeline).
 * @param {Object} payment - Lean payment
 * @returns {Object}
 */
const toBuyerPayment = (payment) => ({
  id: String(payment._id),
  groupId: String(payment.groupId),
  amountPaise: payment.amountPaise,
  currency: payment.currency,
  status: payment.status,
  method: payment.method || null,
  razorpayPaymentId: payment.razorpayPaymentId || null,
  paidAt: payment.paidAt || null,
  refundedPaise: (payment.refunds || [])
    .filter((refund) => refund.status === 'processed')
    .reduce((sum, refund) => sum + refund.amountPaise, 0),
  timeline: moneyTimeline(payment),
});

/**
 * My payments (newest first), optionally for one group.
 * @param {string} userId - Buyer
 * @param {{ groupId?: string, page?: string, limit?: string }} query
 * @returns {Promise<{ payments: Object[], meta: Object }>}
 */
const listMyPayments = async (userId, { groupId, ...query }) => {
  const pagination = getPagination(query);
  const filter = { userId, status: { $in: VISIBLE }, ...(groupId ? { groupId } : {}) };
  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Payment.countDocuments(filter),
  ]);
  return { payments: payments.map(toBuyerPayment), meta: buildPaginationMeta(total, pagination) };
};

module.exports = { moneyTimeline, toBuyerPayment, listMyPayments };
