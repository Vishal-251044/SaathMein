/**
 * Maintenance mode (F35 feature flag `flags.maintenanceMode`): buyers and dealers can still
 * read, but every change (join, pay, bid, chat ...) gets 503 "back soon". Admin, health
 * checks and Razorpay webhooks always work, so money events are never lost.
 */
const ApiError = require('../utils/ApiError');
const { getFeatureFlags } = require('../services/settings.service');

const ALWAYS_OPEN = ['/admin', '/health', '/payments/webhook', '/auth'];
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {Function} next
 */
const maintenanceGuard = async (req, res, next) => {
  try {
    if (READ_METHODS.has(req.method) || ALWAYS_OPEN.some((path) => req.path.startsWith(path))) {
      return next();
    }
    const flags = await getFeatureFlags();
    if (!flags.maintenanceMode) return next();
    return next(
      new ApiError(503, 'SaathMein is being updated. Please try again in a few minutes.', {
        code: 'MAINTENANCE',
      }),
    );
  } catch {
    // Settings unavailable (e.g. database down): do not block on the flag itself
    return next();
  }
};

module.exports = { maintenanceGuard };
