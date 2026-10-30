/**
 * BullMQ queues (Redis). The API only adds jobs; worker.js processes them.
 * - group-deadlines: a repeating sweep every minute (expire groups, open the leader's
 *   extend / start-early window — GRP-5, GRP-8).
 * - auction-close: one delayed job per auction end time; closing runs exactly once
 *   (job id per end time + lock + state machine optimistic lock — CLAUDE.md §8).
 * Without REDIS_URL, scheduling is skipped with a warning (the sweep still catches
 * auctions whose end time passed once Redis is back).
 */
const { getRedis } = require('../config/redis');
const { createLogger } = require('../utils/logger');

const log = createLogger('Queues');

const QUEUE_NAMES = Object.freeze({
  DEADLINES: 'group-deadlines',
  AUCTION_CLOSE: 'auction-close',
});

const DEADLINE_SWEEP_EVERY_MS = 60 * 1000;
const queues = new Map();

/**
 * Get (once) a queue, or null when Redis is not configured.
 * @param {string} name - One of QUEUE_NAMES
 * @returns {import('bullmq').Queue|null}
 */
const getQueue = (name) => {
  const connection = getRedis();
  if (!connection) return null;
  if (!queues.has(name)) {
    // Loaded only when Redis is configured: keeps API start-up (and tests) light
    const { Queue } = require('bullmq');
    queues.set(
      name,
      new Queue(name, {
        connection,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
          removeOnFail: { age: 30 * 24 * 3600 },
        },
      }),
    );
  }
  return queues.get(name);
};

/**
 * Schedule the auction close for the group's current end time. Re-scheduling for a later
 * end time (anti-sniping) adds a new job; the old one finds the auction still running and
 * does nothing.
 * @param {{ _id: *, auction: { endsAt: Date } }} group - Group in auction_live
 * @returns {Promise<boolean>} true when scheduled
 */
const scheduleAuctionClose = async (group) => {
  const queue = getQueue(QUEUE_NAMES.AUCTION_CLOSE);
  const endsAt = group.auction?.endsAt ? new Date(group.auction.endsAt) : null;
  if (!queue || !endsAt) {
    log.warn({ groupId: String(group._id) }, 'Auction close not scheduled (Redis not configured)');
    return false;
  }
  try {
    await queue.add(
      'close',
      { groupId: String(group._id) },
      {
        jobId: `close-${group._id}-${endsAt.getTime()}`, // same end time → same job
        delay: Math.max(0, endsAt.getTime() - Date.now()),
      },
    );
    return true;
  } catch (err) {
    log.error({ err: err.message, groupId: String(group._id) }, 'Could not schedule auction close');
    return false;
  }
};

/**
 * Register the repeating deadline sweep (idempotent; called by the worker on start).
 * @returns {Promise<void>}
 */
const ensureDeadlineSweep = async () => {
  const queue = getQueue(QUEUE_NAMES.DEADLINES);
  if (!queue) return;
  await queue.upsertJobScheduler(
    'deadline-sweep',
    { every: DEADLINE_SWEEP_EVERY_MS },
    { name: 'sweep', data: {} },
  );
};

/** Close all queue connections (shutdown). @returns {Promise<void>} */
const closeQueues = async () => {
  await Promise.allSettled([...queues.values()].map((queue) => queue.close()));
  queues.clear();
};

module.exports = {
  QUEUE_NAMES,
  getQueue,
  scheduleAuctionClose,
  ensureDeadlineSweep,
  closeQueues,
};
