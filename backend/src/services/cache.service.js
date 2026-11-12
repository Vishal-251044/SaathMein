/**
 * Small JSON cache in Redis (Upstash). Fail-open: without Redis, or when Redis errors,
 * the value is simply computed every time. Use for read-heavy, slightly stale data
 * (e.g. Trending, 5 minutes).
 */
const { getRedis } = require('../config/redis');
const { createLogger } = require('../utils/logger');

const log = createLogger('Cache');
const PREFIX = 'cache:';

/**
 * Get a cached value or compute and store it.
 * @template T
 * @param {string} key - Cache key (prefixed with "cache:")
 * @param {number} ttlSeconds - Time to live
 * @param {() => Promise<T>} compute - Loader
 * @returns {Promise<T>}
 */
const remember = async (key, ttlSeconds, compute) => {
  const redis = getRedis();
  if (redis) {
    try {
      const hit = await redis.get(PREFIX + key);
      if (hit) return JSON.parse(hit);
    } catch (err) {
      log.warn({ err: err.message, key }, 'Cache read failed');
    }
  }
  const value = await compute();
  if (redis) {
    redis.set(PREFIX + key, JSON.stringify(value), 'EX', ttlSeconds).catch((err) => {
      log.warn({ err: err.message, key }, 'Cache write failed');
    });
  }
  return value;
};

/**
 * Drop a cached value (after an admin change).
 * @param {string} key
 */
const forget = async (key) => {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(PREFIX + key);
  } catch (err) {
    log.warn({ err: err.message, key }, 'Cache delete failed');
  }
};

module.exports = { remember, forget };
