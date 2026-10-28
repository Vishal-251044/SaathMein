/**
 * Helper for one-off scripts (seeds, create-owner): connect to MongoDB once (no background
 * retries), run the task, always disconnect, and exit with a clear status code.
 */
const mongoose = require('mongoose');
const config = require('../config/env');

/**
 * @param {string} name - Script name for logs
 * @param {(log: import('pino').Logger) => Promise<number|void>} task - Returns an exit code (0 = ok)
 */
const runScript = (name, task) => {
  // Required lazily so the logger picks up config first
  const { createLogger } = require('../utils/logger');
  const log = createLogger(name);

  const main = async () => {
    if (!config.mongo.isConfigured) {
      log.error('MONGODB_URI is not set in backend/.env');
      return 1;
    }
    await mongoose.connect(config.mongo.uri, { serverSelectionTimeoutMS: 15000 });
    return (await task(log)) ?? 0;
  };

  main()
    .then(async (code) => {
      await mongoose.disconnect().catch(() => {});
      process.exit(code);
    })
    .catch(async (err) => {
      log.error({ err }, `${name} failed`);
      await mongoose.disconnect().catch(() => {});
      process.exit(1);
    });
};

module.exports = { runScript };
