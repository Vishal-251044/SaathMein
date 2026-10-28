/**
 * Redis (Upstash) client shared by cache, rate limits, BullMQ and the Socket.io adapter.
 * On Day 1 Redis is optional: if REDIS_URL is not set, the API still runs and
 * /api/health reports redis as "not_configured".
 */
const { Redis } = require('ioredis');
const config = require('./env');
const { createLogger } = require('../utils/logger');

const log = createLogger('Redis');

let client = null;

/**
 * Create (once) and return the shared Redis client.
 * @returns {import('ioredis').Redis|null} Client, or null when REDIS_URL is not configured
 */
const getRedis = () => {
  if (!config.redis.isConfigured) return null;
  if (client) return client;

  client = new Redis(config.redis.url, {
    maxRetriesPerRequest: null, // required by BullMQ workers
    enableReadyCheck: true,
    // Back off up to 10 s between reconnect attempts
    retryStrategy: (times) => Math.min(times * 500, 10000),
  });

  client.on('ready', () => log.info('Redis connected'));
  client.on('error', (err) => log.error({ err: err.message }, 'Redis error'));
  client.on('end', () => log.warn('Redis connection closed'));

  return client;
};

/**
 * Connect at startup and log a clear message when Redis is not configured yet.
 * @returns {void}
 */
const connectRedis = () => {
  if (!config.redis.isConfigured) {
    log.warn('REDIS_URL is not set. Redis features are off until you add it to backend/.env');
    return;
  }
  getRedis();
};

/**
 * Current Redis status for health checks.
 * @returns {'not_configured'|'connected'|'connecting'|'disconnected'} Redis status
 */
const getRedisStatus = () => {
  if (!config.redis.isConfigured) return 'not_configured';
  if (!client) return 'disconnected';
  if (client.status === 'ready') return 'connected';
  if (['connecting', 'connect', 'reconnecting'].includes(client.status)) return 'connecting';
  return 'disconnected';
};

/**
 * Close the Redis connection (graceful shutdown and tests).
 * @returns {Promise<void>}
 */
const disconnectRedis = async () => {
  if (!client) return;
  await client.quit().catch(() => client.disconnect());
  client = null;
};

module.exports = { getRedis, connectRedis, getRedisStatus, disconnectRedis };
