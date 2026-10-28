/**
 * MongoDB (Atlas) connection via Mongoose.
 * Connects with retry + backoff so the API can start (and report "disconnected" on
 * /api/health) even if Atlas is briefly unreachable. Atlas must be a replica set
 * because money flows use multi-document transactions (PAY-2).
 */
const mongoose = require('mongoose');
const config = require('./env');
const { createLogger } = require('../utils/logger');

const log = createLogger('Database');

const MAX_RETRY_DELAY_MS = 30000;
let retryTimer = null;

// Fail fast on queries while disconnected instead of buffering them forever
mongoose.set('bufferCommands', false);
// Reject query filters on fields that are not in the schema
mongoose.set('strictQuery', true);

mongoose.connection.on('connected', () => log.info('MongoDB connected'));
mongoose.connection.on('disconnected', () => log.warn('MongoDB disconnected'));
mongoose.connection.on('error', (err) => log.error({ err }, 'MongoDB connection error'));

/**
 * Connect to MongoDB, retrying with exponential backoff until it succeeds.
 * Does nothing (and logs a clear message) when MONGODB_URI is still a placeholder.
 * @param {number} [attempt=1] - Current attempt number (internal)
 * @returns {Promise<void>}
 */
const connectDB = async (attempt = 1) => {
  if (!config.mongo.isConfigured) {
    log.error('MONGODB_URI is not set. Put your MongoDB Atlas connection string in backend/.env');
    return;
  }

  try {
    await mongoose.connect(config.mongo.uri, {
      serverSelectionTimeoutMS: 10000,
      autoIndex: !config.isProduction, // build indexes automatically only outside production
    });
  } catch (err) {
    const delay = Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS);
    log.error({ err: err.message, attempt }, `MongoDB connect failed, retrying in ${delay} ms`);
    retryTimer = setTimeout(() => connectDB(attempt + 1), delay);
  }
};

/**
 * Current connection state as a simple string for health checks.
 * @returns {'not_configured'|'connected'|'connecting'|'disconnected'} Database status
 */
const getDBStatus = () => {
  if (!config.mongo.isConfigured) return 'not_configured';
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnected' };
  return states[mongoose.connection.readyState] || 'disconnected';
};

/**
 * Close the connection (graceful shutdown and tests).
 * @returns {Promise<void>}
 */
const disconnectDB = async () => {
  clearTimeout(retryTimer);
  await mongoose.disconnect();
};

module.exports = { connectDB, getDBStatus, disconnectDB };
