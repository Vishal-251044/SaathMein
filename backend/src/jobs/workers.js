/**
 * BullMQ workers (run by worker.js as a separate process, never inside the API):
 * - group-deadlines: the minute sweep (deadlines, overdue auctions, expired waitlist seat
 *   offers, failed refunds to retry).
 * - auction-close: closes one auction at its end time.
 * - refunds: one Razorpay refund per job (retried with backoff).
 * - reconciliation: nightly comparison with Razorpay.
 */
const { Worker } = require('bullmq');
const { getRedis } = require('../config/redis');
const { createLogger } = require('../utils/logger');
const { QUEUE_NAMES, ensureDeadlineSweep } = require('./queues');
const { processDeadlines, sendDeadlineReminders } = require('../services/groups/deadline.service');
const { sendDeferredPushes } = require('../services/notifications/notification.service');
const { closeAuction, closeOverdueAuctions } = require('../services/auction/auctionClose.service');
const { processAuctionTimeouts } = require('../services/auction/winner.service');
const { retryMissingHolds } = require('../services/auction/settlement.service');
const { processPurchaseTimers } = require('../services/purchases/purchase.service');
const { processDisputeDeadlines } = require('../services/trust/dispute.service');
const { runAlertRules } = require('../services/alerts/alertRules.service');
const { raiseAlert } = require('../services/alerts/alert.service');
const { generateMonthlyInvoices } = require('../services/payments/commission.service');
const { expireSeatOffers } = require('../services/groups/membership.service');
const { refundPayment, retryFailedRefunds } = require('../services/payments/refund.service');
const { runReconciliation } = require('../services/payments/reconciliation.service');

const log = createLogger('Workers');

/** Job handlers by queue (exported for tests). */
const PROCESSORS = {
  [QUEUE_NAMES.DEADLINES]: async () => {
    const deadlines = await processDeadlines();
    const auctionsClosed = await closeOverdueAuctions();
    const offersExpired = await expireSeatOffers();
    const refundsRetried = await retryFailedRefunds();
    const reminders = await sendDeadlineReminders();
    const pushesSent = await sendDeferredPushes();
    const auctionTimeouts = await processAuctionTimeouts();
    const holdsCreated = await retryMissingHolds();
    const purchases = await processPurchaseTimers();
    const disputesEscalated = await processDisputeDeadlines();
    const alertsFired = await runAlertRules();
    return {
      ...deadlines,
      auctionsClosed,
      offersExpired,
      refundsRetried,
      reminders,
      pushesSent,
      auctionTimeouts,
      holdsCreated,
      purchases,
      disputesEscalated,
      alertsFired,
    };
  },
  [QUEUE_NAMES.AUCTION_CLOSE]: async (job) => closeAuction(job.data.groupId),
  [QUEUE_NAMES.REFUNDS]: async (job) => {
    const { paymentId, attempt: _attempt, ...refund } = job.data;
    return refundPayment(paymentId, refund);
  },
  [QUEUE_NAMES.RECONCILIATION]: async (job) => {
    const report = await runReconciliation(job.data?.day ? { day: job.data.day } : {});
    return { day: report.day, status: report.status };
  },
  // Previous IST month by default; Finance can also run a month from the console
  [QUEUE_NAMES.COMMISSION_INVOICES]: async (job) => generateMonthlyInvoices(job.data?.month),
};

/**
 * Start every worker and the repeating sweep.
 * @returns {Promise<Worker[]>}
 * @throws {Error} When Redis is not configured
 */
const startWorkers = async () => {
  const connection = getRedis();
  if (!connection) throw new Error('REDIS_URL is not set; the worker needs Redis');

  const workers = Object.entries(PROCESSORS).map(([name, processor]) => {
    const worker = new Worker(name, processor, { connection, concurrency: 4 });
    worker.on('failed', (job, err) => {
      log.error(
        { queue: name, jobId: job?.id, attempts: job?.attemptsMade, err: err.message },
        'Job failed',
      );
      // PRD Alerts: "auction job failed to close" goes to the Owner and Deal Manager
      if (name === QUEUE_NAMES.AUCTION_CLOSE) {
        raiseAlert({
          type: 'auction',
          severity: 'critical',
          title: 'Auction close job failed',
          message: `${err.message}. The minute sweep retries overdue auctions.`,
          subjectType: 'group',
          subjectId: job?.data?.groupId,
          dedupeKey: `auction:close-failed:${job?.data?.groupId}`,
        });
      }
    });
    worker.on('error', (err) => log.error({ queue: name, err: err.message }, 'Worker error'));
    return worker;
  });

  await ensureDeadlineSweep();
  log.info({ queues: Object.keys(PROCESSORS) }, 'Workers started');
  return workers;
};

module.exports = { PROCESSORS, startWorkers };
