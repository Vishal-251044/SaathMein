/**
 * SaathMein background worker entry point (separate process from the API):
 * group deadlines and auction close (BullMQ). Run with `npm run worker`.
 */
const { connectDB, disconnectDB } = require('./src/config/db');
const { connectRedis, disconnectRedis } = require('./src/config/redis');
const { createLogger } = require('./src/utils/logger');

// Register all models before any query
require('./src/models');

const { startWorkers } = require('./src/jobs/workers');
const { closeQueues } = require('./src/jobs/queues');

const log = createLogger('Worker');
let workers = [];

/**
 * Close workers and connections, then exit. Forces exit after 15 s.
 * @param {string} signal - Signal that triggered shutdown
 */
const shutdown = async (signal) => {
  log.info(`${signal} received, stopping workers`);
  setTimeout(() => process.exit(1), 15000).unref();
  await Promise.allSettled(workers.map((worker) => worker.close()));
  await closeQueues();
  await Promise.allSettled([disconnectDB(), disconnectRedis()]);
  process.exit(0);
};

const start = async () => {
  connectDB();
  connectRedis();
  try {
    workers = await startWorkers();
  } catch (err) {
    log.fatal({ err: err.message }, 'Worker could not start');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) =>
  log.error({ err: reason }, 'Unhandled promise rejection'),
);

start();
