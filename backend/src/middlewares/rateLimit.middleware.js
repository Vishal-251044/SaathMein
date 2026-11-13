/**
 * Rate limiters. A general limiter protects the whole API; stricter limiters (staff login,
 * deal codes, invites) are created per route. Counters live in Redis when it is connected
 * (shared by every API instance — Day 14 hardening) and fall back to process memory
 * otherwise, through the same fixed-window counter as the business limits.
 */
const crypto = require('crypto');
const { rateLimit } = require('express-rate-limit');
const ApiError = require('../utils/ApiError');
const { hit } = require('../services/rateLimit.service');

/**
 * express-rate-limit store backed by services/rateLimit.service (Redis or memory).
 * Each limiter gets its own key prefix so their counters never mix.
 */
class SharedCounterStore {
  /** @param {string} prefix - Unique, stable name of the limiter */
  constructor(prefix) {
    this.prefix = `http:${prefix}`;
    this.localKeys = false; // counts are shared across instances when Redis is up
  }

  /** @param {{ windowMs: number }} options - Limiter options */
  init(options) {
    this.windowMs = options.windowMs;
  }

  /**
   * @param {string} key - Client key (IP)
   * @returns {Promise<{ totalHits: number, resetTime: Date }>}
   */
  async increment(key) {
    const { count, resetAt } = await hit(`${this.prefix}:${key}`, this.windowMs);
    return { totalHits: count, resetTime: new Date(resetAt) };
  }

  /** Fixed windows: nothing to undo (the counter simply expires). */
  async decrement() {}

  /** Not used (no "reset on success" limiters). */
  async resetKey() {}
}

/**
 * Build a rate limiter that responds with the standard error format.
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.limit - Max requests per window per key
 * @param {string} options.message - Message shown when the limit is hit
 * @param {string} [options.name] - Stable limiter name (defaults to a hash of the options)
 * @returns {Function} Express middleware
 */
const createRateLimiter = ({ windowMs, limit, message, name }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: new SharedCounterStore(
      name ||
        crypto
          .createHash('sha1')
          .update(`${windowMs}|${limit}|${message}`)
          .digest('hex')
          .slice(0, 12),
    ),
    handler: (req, res, next) => next(new ApiError(429, message)),
  });

/** General API limit: 300 requests per 15 minutes per IP. */
const apiLimiter = createRateLimiter({
  name: 'api',
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: 'Too many requests. Please slow down and try again in a few minutes.',
});

module.exports = { createRateLimiter, apiLimiter, SharedCounterStore };
