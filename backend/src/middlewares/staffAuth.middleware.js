/**
 * Staff auth middleware for the Owner / Admin Console (PRD §8.2, ADL-4).
 * requireStaff(...roles) checks, on every request:
 *  1. a valid STAFF access token (an app/buyer token gets 403, not 401),
 *  2. the session is not revoked, expired or idle for 30 minutes,
 *  3. the user is still active staff with an allowed role.
 * The Owner passes every role check.
 */
const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const { extractBearerToken } = require('./auth.middleware');
const { verifyAccessToken, isValidAppToken } = require('../services/auth/token.service');
const { assertStaffSessionActive } = require('../services/auth/session.service');
const { ACCOUNT_STATUS, STAFF_ROLE, TOKEN_AUDIENCE } = require('../constants/enums');

const STAFF_ONLY_MESSAGE = 'Staff access only';

/**
 * Build the staff guard.
 * @param {...string} allowedRoles - STAFF_ROLE values allowed; none = any staff role
 * @returns {Function} Async Express middleware that sets `req.staff = { userId, role, sessionId }`
 */
const requireStaff =
  (...allowedRoles) =>
  async (req, res, next) => {
    const token = extractBearerToken(req);
    if (!token) return next(ApiError.unauthorized());

    let payload;
    try {
      payload = verifyAccessToken(token, TOKEN_AUDIENCE.STAFF);
    } catch (err) {
      // A genuine buyer/seller token is authenticated, just not allowed here → 403
      if (isValidAppToken(token)) return next(ApiError.forbidden(STAFF_ONLY_MESSAGE));
      return next(err);
    }

    try {
      await assertStaffSessionActive(payload.sid, payload.sub);

      const user = await User.findById(payload.sub).select('staffRole status');
      if (!user || !user.staffRole || user.status !== ACCOUNT_STATUS.ACTIVE) {
        return next(ApiError.forbidden(STAFF_ONLY_MESSAGE));
      }

      // Role comes from the database, not the token, so role changes apply immediately
      const isAllowed =
        allowedRoles.length === 0 ||
        user.staffRole === STAFF_ROLE.OWNER ||
        allowedRoles.includes(user.staffRole);
      if (!isAllowed) return next(ApiError.forbidden());

      req.staff = { userId: payload.sub, role: user.staffRole, sessionId: payload.sid };
      return next();
    } catch (err) {
      return next(err);
    }
  };

/**
 * CSRF guard for routes authenticated by cookie (staff refresh/logout).
 * Browsers cannot add a custom header cross-site without a CORS preflight, which our CORS
 * whitelist blocks, so requiring it stops forged form posts.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {Function} next - Next middleware
 */
const requireXhrHeader = (req, res, next) => {
  if (req.get('x-requested-with') !== 'XMLHttpRequest') {
    return next(ApiError.forbidden('Missing X-Requested-With header'));
  }
  return next();
};

module.exports = { requireStaff, requireXhrHeader };
