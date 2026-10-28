/**
 * Rate limiters. A general limiter protects the whole API; stricter limiters
 * (OTP, bids, AI) are added per route in later days.
 * Uses in-memory storage for now; switch to a Redis store when the API runs on more
 * than one instance.
 */
const { rateLimit } = require('express-rate-limit');
const ApiError = require('../utils/ApiError');

/**
 * Build a rate limiter that responds with the standard error format.
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.limit - Max requests per window per key
 * @param {string} options.message - Message shown when the limit is hit
 * @returns {Function} Express middleware
 */
const createRateLimiter = ({ windowMs, limit, message }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res, next) => next(new ApiError(429, message)),
  });

/** General API limit: 300 requests per 15 minutes per IP. */
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: 'Too many requests. Please slow down and try again in a few minutes.',
});

module.exports = { createRateLimiter, apiLimiter };
