/**
 * SaathMein API entry point.
 * Loads config, connects MongoDB and Redis, starts the HTTP server and handles
 * graceful shutdown. (Socket.io attaches to this server on Day 8.)
 */
const http = require('http');
const config = require('./src/config/env');
const app = require('./src/app');
const { connectDB, disconnectDB } = require('./src/config/db');
const { connectRedis, disconnectRedis } = require('./src/config/redis');
const { createLogger } = require('./src/utils/logger');

// Register all models before any connection or query
require('./src/models');

const log = createLogger('Server');
const server = http.createServer(app);

/**
 * Start the server. The DB connects in the background with retries, so /api/health
 * can report "disconnected" instead of the process crashing on a slow network.
 * @returns {void}
 */
const start = () => {
  connectDB();
  connectRedis();

  server.listen(config.port, () => {
    log.info(`SaathMein API listening on http://localhost:${config.port} (${config.env})`);
  });
};

/**
 * Close the server and connections, then exit. Forces exit after 10 s.
 * @param {string} signal - Signal or reason that triggered shutdown
 * @returns {void}
 */
const shutdown = (signal) => {
  log.info(`${signal} received, shutting down`);
  setTimeout(() => process.exit(1), 10000).unref();

  server.close(async () => {
    await Promise.allSettled([disconnectDB(), disconnectRedis()]);
    log.info('Shutdown complete');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  log.error({ err: reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  log.fatal({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});

start();
