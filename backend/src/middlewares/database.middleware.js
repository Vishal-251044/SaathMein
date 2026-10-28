/**
 * Database guard — answers 503 instead of a confusing 500 when MongoDB is not connected
 * (Atlas not configured yet, network blip, failover). /api/health is mounted before this
 * so it can always report status.
 */
const ApiError = require('../utils/ApiError');
const { getDBStatus } = require('../config/db');

/**
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {Function} next - Next middleware
 */
const requireDatabase = (req, res, next) => {
  if (getDBStatus() === 'connected') return next();
  return next(
    new ApiError(503, 'SaathMein is temporarily unavailable. Please try again in a minute.', {
      code: 'DATABASE_UNAVAILABLE',
    }),
  );
};

module.exports = { requireDatabase };
