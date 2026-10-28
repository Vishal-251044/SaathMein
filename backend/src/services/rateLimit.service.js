/**
 * Fixed-window counters for business rate limits (OTP requests, login attempts).
 * Uses Redis when it is connected, so limits hold across API instances; otherwise falls
 * back to process memory (fine for one instance in development).
 */
const { getRedis } = require('../config/redis');
const ApiError = require('../utils/ApiError');
const { createLogger } = require('../utils/logger');

const log = createLogger('RateLimitService');
const KEY_PREFIX = 'sm:rl:';

/** In-memory fallback: key → { count, resetAt } */
const memoryCounters = new Map();

/**
 * Count a hit in memory.
 * @param {string} key - Counter key
 * @param {number} windowMs - Window length
 * @returns {{ count: number, resetAt: number }}
 */
const hitMemory = (key, windowMs) => {
  const now = Date.now();
  const current = memoryCounters.get(key);
  if (!current || current.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + windowMs };
    memoryCounters.set(key, fresh);
    return fresh;
  }
  current.count += 1;
  return current;
};

/**
 * Count one hit for a key in the current window.
 * @param {string} key - Counter key, e.g. "otp:phone:+919876543210"
 * @param {number} windowMs - Window length in ms
 * @returns {Promise<{ count: number, resetAt: number }>} Hits so far and window reset time
 */
const hit = async (key, windowMs) => {
  const redis = getRedis();
  if (redis && redis.status === 'ready') {
    try {
      const fullKey = KEY_PREFIX + key;
      const count = await redis.incr(fullKey);
      if (count === 1) await redis.pexpire(fullKey, windowMs);
      const ttl = await redis.pttl(fullKey);
      return { count, resetAt: Date.now() + Math.max(ttl, 0) };
    } catch (err) {
      log.warn({ err: err.message }, 'Redis rate limit failed, using memory counter');
    }
  }
  return hitMemory(key, windowMs);
};

/**
 * Count a hit and throw 429 when the limit is exceeded.
 * @param {Object} params
 * @param {string} params.key - Counter key
 * @param {number} params.limit - Max hits per window
 * @param {number} params.windowMs - Window length in ms
 * @param {string} params.message - User-facing message
 * @param {string} [params.code='TOO_MANY_REQUESTS'] - Error code
 * @returns {Promise<void>}
 * @throws {ApiError} 429 with `details.retryAfterSeconds`
 */
const assertWithinLimit = async ({ key, limit, windowMs, message, code = 'TOO_MANY_REQUESTS' }) => {
  const { count, resetAt } = await hit(key, windowMs);
  if (count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    throw new ApiError(429, message, { code, details: { retryAfterSeconds } });
  }
};

/** Clear in-memory counters (tests only). */
const resetMemoryCounters = () => memoryCounters.clear();

module.exports = { hit, assertWithinLimit, resetMemoryCounters };
