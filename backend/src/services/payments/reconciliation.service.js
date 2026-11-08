/**
 * Daily reconciliation (PAY-7): compares one IST day of Razorpay payments and refunds with
 * our payments and ledger. Safe gaps are fixed automatically (a captured token whose
 * webhook was lost → joined or refunded through the normal join path; a refund processed
 * at Razorpay but still pending here → ledger written). Everything else is stored as a
 * mismatch for the admin Payment monitor (Day 13).
 */
const Payment = require('../../models/payment.model');
const Ledger = require('../../models/ledger.model');
const ReconciliationReport = require('../../models/reconciliationReport.model');
const { createLogger } = require('../../utils/logger');
const razorpay = require('./razorpay.service');
const { confirmCapturedPayment } = require('./payment.service');
const { markRefundProcessed } = require('./refund.service');
const { LEDGER_TYPE, PAYMENT_STATUS } = require('../../constants/enums');

const log = createLogger('Reconciliation');
const PAGE = 100;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The previous IST calendar day as YYYY-MM-DD.
 * @param {Date} [now]
 * @returns {string}
 */
const yesterdayIst = (now = new Date()) =>
  new Date(now.getTime() + IST_OFFSET_MS - DAY_MS).toISOString().slice(0, 10);

/**
 * UTC window of an IST day.
 * @param {string} day - YYYY-MM-DD
 * @returns {{ start: Date, end: Date }}
 */
const istDayWindow = (day) => {
  const start = new Date(`${day}T00:00:00+05:30`);
  return { start, end: new Date(start.getTime() + DAY_MS) };
};

/**
 * All Razorpay entities of a kind created in the window (paged).
 * @param {'payments'|'refunds'} kind
 * @param {{ start: Date, end: Date }} window
 * @returns {Promise<Object[]>}
 */
const fetchAll = async (kind, { start, end }) => {
  const items = [];
  for (let skip = 0; ; skip += PAGE) {
    const page = await razorpay.listEntities(kind, {
      from: Math.floor(start.getTime() / 1000),
      to: Math.floor(end.getTime() / 1000) - 1,
      count: PAGE,
      skip,
    });
    items.push(...(page.items || []));
    if ((page.items || []).length < PAGE) break;
  }
  return items;
};

/** Sum of ledger amounts of one type created in the window (paise). */
const ledgerTotal = async (type, { start, end }) => {
  const [row] = await Ledger.aggregate([
    { $match: { type, createdAt: { $gte: start, $lt: end } } },
    { $group: { _id: null, total: { $sum: '$amountPaise' } } },
  ]);
  return row?.total ?? 0;
};

/**
 * Reconcile one IST day and store the report.
 * @param {{ day?: string }} [options] - Default: yesterday (IST)
 * @returns {Promise<Object>} The saved report
 */
const runReconciliation = async ({ day = yesterdayIst() } = {}) => {
  const window = istDayWindow(day);
  const mismatches = [];
  try {
    const [rpPayments, rpRefunds] = await Promise.all([
      fetchAll('payments', window),
      fetchAll('refunds', window),
    ]);
    const captured = rpPayments.filter((entity) =>
      ['captured', 'refunded'].includes(entity.status),
    );
    const ours = await Payment.find({
      razorpayOrderId: { $in: captured.map((entity) => entity.order_id) },
    }).lean();
    const byOrder = new Map(ours.map((payment) => [payment.razorpayOrderId, payment]));

    for (const entity of captured) {
      const payment = byOrder.get(entity.order_id);
      if (!payment) continue; // not a SaathMein token order (e.g. a test payment)
      if ([PAYMENT_STATUS.CREATED, PAYMENT_STATUS.FAILED].includes(payment.status)) {
        // Webhook lost: run the normal join path (joins, or refunds when no seat is left)
        await confirmCapturedPayment(
          payment,
          { ...entity, status: 'captured' },
          { source: 'reconciliation' },
        );
        mismatches.push({
          kind: 'missed_capture',
          razorpayId: entity.id,
          paymentId: payment._id,
          actualPaise: entity.amount,
          autoFixed: true,
        });
      } else if (entity.amount !== payment.amountPaise) {
        mismatches.push({
          kind: 'amount_mismatch',
          razorpayId: entity.id,
          paymentId: payment._id,
          expectedPaise: payment.amountPaise,
          actualPaise: entity.amount,
        });
      }
      // Record Razorpay fees per payment for reports (PAY-8)
      if (entity.fee != null && payment.razorpayFeePaise == null) {
        await Payment.updateOne(
          { _id: payment._id },
          { $set: { razorpayFeePaise: entity.fee, razorpayTaxPaise: entity.tax ?? 0 } },
        );
      }
    }

    const refundIds = rpRefunds.map((entity) => entity.id);
    const withRefunds = await Payment.find({ 'refunds.razorpayRefundId': { $in: refundIds } })
      .select('refunds')
      .lean();
    const ourRefunds = new Map(
      withRefunds.flatMap((payment) =>
        payment.refunds.map((refund) => [
          refund.razorpayRefundId,
          { refund, paymentId: payment._id },
        ]),
      ),
    );
    for (const entity of rpRefunds) {
      const match = ourRefunds.get(entity.id);
      if (!match) {
        if (entity.notes?.paymentId) {
          mismatches.push({
            kind: 'unknown_refund',
            razorpayId: entity.id,
            actualPaise: entity.amount,
            detail: `notes.paymentId=${entity.notes.paymentId}`,
          });
        }
        continue;
      }
      if (entity.status === 'processed' && match.refund.status !== 'processed') {
        await markRefundProcessed(entity.id);
        mismatches.push({
          kind: 'missed_refund_processed',
          razorpayId: entity.id,
          paymentId: match.paymentId,
          actualPaise: entity.amount,
          autoFixed: true,
        });
      } else if (entity.amount !== match.refund.amountPaise) {
        mismatches.push({
          kind: 'refund_amount_mismatch',
          razorpayId: entity.id,
          paymentId: match.paymentId,
          expectedPaise: match.refund.amountPaise,
          actualPaise: entity.amount,
        });
      }
    }

    const ourCaptured = captured.filter((entity) => byOrder.has(entity.order_id));
    const totals = {
      capturedPaise: ourCaptured.reduce((sum, entity) => sum + entity.amount, 0),
      ledgerHeldPaise: await ledgerTotal(LEDGER_TYPE.TOKEN_HELD, window),
      refundedPaise: rpRefunds
        .filter((entity) => ourRefunds.has(entity.id) && entity.status === 'processed')
        .reduce((sum, entity) => sum + entity.amount, 0),
      ledgerRefundedPaise: await ledgerTotal(LEDGER_TYPE.REFUND, window),
    };
    const unresolved = mismatches.filter((mismatch) => !mismatch.autoFixed);
    const report = await ReconciliationReport.create({
      day,
      status: unresolved.length ? 'mismatch' : 'ok',
      counts: {
        razorpayPayments: ourCaptured.length,
        razorpayRefunds: ourRefunds.size,
        ourPayments: ours.length,
        ourRefunds: ourRefunds.size,
      },
      totals,
      mismatches,
    });
    log.info(
      { day, status: report.status, mismatches: mismatches.length, totals },
      'Reconciliation finished',
    );
    return report;
  } catch (err) {
    log.error({ day, err: err.message }, '[Reconciliation] run failed');
    return ReconciliationReport.create({ day, status: 'failed', error: err.message, mismatches });
  }
};

module.exports = { yesterdayIst, istDayWindow, runReconciliation };
