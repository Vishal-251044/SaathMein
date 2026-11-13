/**
 * Alert rules checked by the minute sweep (PRD §10.11 Alerts):
 * - payment success rate below 90% in the last hour (with enough payments to matter)
 * - refunds stuck for more than 24 h
 * - Route transfers still pending after 24 h
 * - job queue backlog growing (auction close, refunds, deadlines)
 * Each rule raises a deduplicated alert; it never throws.
 */
const Payment = require('../../models/payment.model');
const { createLogger } = require('../../utils/logger');
const { getSettings } = require('../settings.service');
const { getQueue, QUEUE_NAMES } = require('../../jobs/queues');
const { raiseAlert } = require('./alert.service');
const { PAYMENT_STATUS } = require('../../constants/enums');

const log = createLogger('AlertRules');
const HOUR_MS = 60 * 60 * 1000;

/**
 * Success rate in basis points (pure).
 * @param {number} captured
 * @param {number} failed
 * @returns {number|null} null without attempts
 */
const successRateBps = (captured, failed) => {
  const total = captured + failed;
  return total ? Math.round((captured / total) * 10_000) : null;
};

/** Payments in the last hour. */
const checkPaymentSuccess = async (now, settings) => {
  const since = new Date(now.getTime() - HOUR_MS);
  const [captured, failed] = await Promise.all([
    Payment.countDocuments({ paidAt: { $gte: since } }),
    Payment.countDocuments({ status: PAYMENT_STATUS.FAILED, updatedAt: { $gte: since } }),
  ]);
  const rate = successRateBps(captured, failed);
  if (rate === null || captured + failed < settings.paymentSuccessMinSample) return false;
  if (rate >= settings.paymentSuccessMinBps) return false;
  await raiseAlert({
    type: 'payment',
    severity: 'critical',
    title: `Payment success rate is ${(rate / 100).toFixed(1)}% this hour`,
    message: `${captured} captured, ${failed} failed in the last hour. Check Razorpay status and the Payment monitor.`,
    subjectType: 'payment',
    dedupeKey: 'payments:success-rate',
  });
  return true;
};

/** Refunds still pending or failed after N hours. */
const checkStuckRefunds = async (now, settings) => {
  const before = new Date(now.getTime() - settings.refundStuckHours * HOUR_MS);
  const stuck = await Payment.countDocuments({
    refunds: {
      $elemMatch: { status: { $in: ['pending', 'failed'] }, createdAt: { $lte: before } },
    },
  });
  if (!stuck) return false;
  await raiseAlert({
    type: 'payment',
    severity: 'warning',
    title: `${stuck} refund(s) stuck for over ${settings.refundStuckHours} hours`,
    message: 'Retry them from the Payment monitor or check them in the Razorpay dashboard.',
    subjectType: 'payment',
    dedupeKey: 'refunds:stuck',
  });
  return true;
};

/** Transfers to dealers still pending after N hours. */
const checkPendingTransfers = async (now, settings) => {
  const before = new Date(now.getTime() - settings.transferPendingHours * HOUR_MS);
  const pending = await Payment.countDocuments({
    'transfer.status': 'pending',
    updatedAt: { $lte: before },
  });
  if (!pending) return false;
  await raiseAlert({
    type: 'payment',
    severity: 'warning',
    title: `${pending} dealer transfer(s) pending for over ${settings.transferPendingHours} hours`,
    message: 'Razorpay has not confirmed these Route transfers. Check the Payment monitor.',
    subjectType: 'payment',
    dedupeKey: 'transfers:pending',
  });
  return true;
};

/** Jobs waiting in the queues. */
const checkQueueBacklog = async (settings) => {
  let waiting = 0;
  for (const name of Object.values(QUEUE_NAMES)) {
    const queue = getQueue(name);
    if (!queue) continue;
    const counts = await queue.getJobCounts('waiting', 'delayed', 'failed');
    waiting += (counts.waiting || 0) + (counts.failed || 0);
  }
  if (waiting <= settings.queueBacklogMax) return false;
  await raiseAlert({
    type: 'system',
    severity: 'critical',
    title: `Job queue backlog: ${waiting} jobs waiting or failed`,
    message: 'Workers may be down or failing. Check the System health monitor.',
    subjectType: 'system',
    dedupeKey: 'system:queue-backlog',
  });
  return true;
};

/**
 * Run every rule (minute sweep).
 * @param {Date} [now]
 * @returns {Promise<number>} Rules that fired
 */
const runAlertRules = async (now = new Date()) => {
  const settings = await getSettings('alerts');
  let fired = 0;
  for (const rule of [
    () => checkPaymentSuccess(now, settings),
    () => checkStuckRefunds(now, settings),
    () => checkPendingTransfers(now, settings),
    () => checkQueueBacklog(settings),
  ]) {
    try {
      if (await rule()) fired += 1;
    } catch (err) {
      log.warn({ err: err.message }, 'Alert rule failed');
    }
  }
  return fired;
};

module.exports = { successRateBps, runAlertRules };
