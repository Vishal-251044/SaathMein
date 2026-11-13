/**
 * Payment monitor (Razorpay, PRD §10.11): captured / failed today, success rate by method
 * (UPI, card, ...), tokens held, refunds pending or failed, Route transfers on hold /
 * released / failed, webhook failures and the latest reconciliation, plus lists to act on.
 */
const Payment = require('../../models/payment.model');
const ReconciliationReport = require('../../models/reconciliationReport.model');
const WebhookEvent = require('../../models/webhookEvent.model');
const { getPagination, buildPaginationMeta } = require('../../helpers/genericFunctions');
const { PAYMENT_STATUS } = require('../../constants/enums');
const { istDayStart } = require('./monitor.service');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Numbers for the monitor.
 * @param {{ from?: string, to?: string }} filters - Date range (default: today, IST)
 * @param {Date} [now]
 */
const getPaymentMonitor = async ({ from, to } = {}, now = new Date()) => {
  const start = from ? new Date(from) : istDayStart(now);
  const end = to ? new Date(new Date(to).getTime() + DAY_MS) : new Date(now.getTime() + 1);
  const range = { $gte: start, $lt: end };

  const [byMethod, failedByMethod, held, refunds, transfers, webhookFailures, reconciliation] =
    await Promise.all([
      Payment.aggregate([
        { $match: { paidAt: range } },
        {
          $group: {
            _id: { $ifNull: ['$method', 'unknown'] },
            count: { $sum: 1 },
            paise: { $sum: '$amountPaise' },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { status: PAYMENT_STATUS.FAILED, updatedAt: range } },
        { $group: { _id: { $ifNull: ['$method', 'unknown'] }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { status: PAYMENT_STATUS.PAID } },
        { $group: { _id: null, count: { $sum: 1 }, paise: { $sum: '$amountPaise' } } },
      ]),
      Payment.aggregate([
        { $unwind: '$refunds' },
        { $match: { 'refunds.status': { $in: ['pending', 'failed'] } } },
        {
          $group: {
            _id: '$refunds.status',
            count: { $sum: 1 },
            paise: { $sum: '$refunds.amountPaise' },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { transfer: { $exists: true } } },
        {
          $group: {
            _id: '$transfer.status',
            count: { $sum: 1 },
            paise: { $sum: '$transfer.amountPaise' },
          },
        },
      ]),
      WebhookEvent.find({ status: 'failed' }).sort({ createdAt: -1 }).limit(20).lean(),
      ReconciliationReport.findOne().sort({ createdAt: -1 }).lean(),
    ]);

  const failedMap = new Map(failedByMethod.map((row) => [row._id, row.count]));
  const methods = [...new Set([...byMethod.map((row) => row._id), ...failedMap.keys()])].map(
    (method) => {
      const captured = byMethod.find((row) => row._id === method);
      const failed = failedMap.get(method) || 0;
      const count = captured?.count || 0;
      return {
        method,
        captured: count,
        capturedPaise: captured?.paise || 0,
        failed,
        successRateBps: count + failed ? Math.round((count / (count + failed)) * 10_000) : null,
      };
    },
  );
  const sum = (rows, key) =>
    Object.fromEntries(rows.map((row) => [row._id, { count: row.count, paise: row.paise }]))[
      key
    ] || { count: 0, paise: 0 };
  const totalCaptured = methods.reduce((total, row) => total + row.captured, 0);
  const totalFailed = methods.reduce((total, row) => total + row.failed, 0);

  return {
    range: { from: start, to: end },
    captured: totalCaptured,
    capturedPaise: methods.reduce((total, row) => total + row.capturedPaise, 0),
    failed: totalFailed,
    successRateBps:
      totalCaptured + totalFailed
        ? Math.round((totalCaptured / (totalCaptured + totalFailed)) * 10_000)
        : null,
    byMethod: methods,
    tokensWithSaathMein: { count: held[0]?.count || 0, paise: held[0]?.paise || 0 },
    refunds: { pending: sum(refunds, 'pending'), failed: sum(refunds, 'failed') },
    transfers: {
      onHold: {
        count: sum(transfers, 'pending').count + sum(transfers, 'processed').count,
        paise: sum(transfers, 'pending').paise + sum(transfers, 'processed').paise,
      },
      released: sum(transfers, 'released'),
      reversed: sum(transfers, 'reversed'),
      failed: sum(transfers, 'failed'),
    },
    webhookFailures: webhookFailures.map((event) => ({
      eventId: event.eventId,
      event: event.event || null,
      error: event.error || null,
      at: event.createdAt,
    })),
    reconciliation: reconciliation
      ? {
          day: reconciliation.day,
          status: reconciliation.status,
          mismatches: (reconciliation.mismatches || []).length,
          unresolved: (reconciliation.mismatches || []).filter((item) => !item.autoFixed).length,
          at: reconciliation.createdAt,
        }
      : null,
  };
};

/** Row for the payments table. */
const toPaymentRow = (payment) => ({
  id: String(payment._id),
  groupId: String(payment.groupId),
  userId: String(payment.userId),
  razorpayPaymentId: payment.razorpayPaymentId || null,
  amountPaise: payment.amountPaise,
  method: payment.method || null,
  status: payment.status,
  paidAt: payment.paidAt || null,
  refunds: (payment.refunds || []).map((refund) => ({
    reason: refund.reason,
    amountPaise: refund.amountPaise,
    status: refund.status,
    createdAt: refund.createdAt,
    lastError: refund.lastError || null,
  })),
  transfer: payment.transfer
    ? {
        status: payment.transfer.status,
        amountPaise: payment.transfer.amountPaise,
        commissionPaise: payment.transfer.commissionPaise || 0,
        sellerId: payment.transfer.sellerId ? String(payment.transfer.sellerId) : null,
      }
    : null,
});

/**
 * Payments to act on.
 * @param {{ view?: 'all'|'refunds_failed'|'refunds_pending'|'held'|'transfer_failed', q?: string,
 *   page?: string, limit?: string }} query
 */
const listPayments = async ({ view = 'all', q, ...query } = {}) => {
  const pagination = getPagination(query);
  const filters = {
    all: {},
    refunds_failed: { 'refunds.status': 'failed' },
    refunds_pending: { 'refunds.status': 'pending' },
    held: { 'transfer.status': { $in: ['pending', 'processed'] } },
    transfer_failed: { 'transfer.status': 'failed' },
  };
  const filter = {
    ...(filters[view] || {}),
    ...(q ? { $or: [{ razorpayPaymentId: q.trim() }, { razorpayOrderId: q.trim() }] } : {}),
  };
  const [rows, total] = await Promise.all([
    Payment.find(filter)
      .sort({ updatedAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Payment.countDocuments(filter),
  ]);
  return { payments: rows.map(toPaymentRow), meta: buildPaginationMeta(total, pagination) };
};

module.exports = { getPaymentMonitor, listPayments, toPaymentRow };
