/**
 * BullMQ workers (run by worker.js as a separate process, never inside the API):
 * - group-deadlines: the minute sweep (deadlines + overdue auction safety net).
 * - auction-close: closes one auction at its end time.
 */
const { Worker } = require('bullmq');
const { getRedis } = require('../config/redis');
const { createLogger } = require('../utils/logger');
const { QUEUE_NAMES, ensureDeadlineSweep } = require('./queues');
const { processDeadlines } = require('../services/groups/deadline.service');
const { closeAuction, closeOverdueAuctions } = require('../services/auction/auctionClose.service');

const log = createLogger('Workers');

/** Job handlers by queue (exported for tests). */
const PROCESSORS = {
  [QUEUE_NAMES.DEADLINES]: async () => {
    const deadlines = await processDeadlines();
    const auctionsClosed = await closeOverdueAuctions();
    return { ...deadlines, auctionsClosed };
  },
  [QUEUE_NAMES.AUCTION_CLOSE]: async (job) => closeAuction(job.data.groupId),
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
    worker.on('failed', (job, err) =>
      log.error(
        { queue: name, jobId: job?.id, attempts: job?.attemptsMade, err: err.message },
        'Job failed',
      ),
    );
    worker.on('error', (err) => log.error({ queue: name, err: err.message }, 'Worker error'));
    return worker;
  });

  await ensureDeadlineSweep();
  log.info({ queues: Object.keys(PROCESSORS) }, 'Workers started');
  return workers;
};

module.exports = { PROCESSORS, startWorkers };
