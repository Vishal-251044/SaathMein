/**
 * App auth middleware for buyers and sellers.
 * - requireAuth: a valid app access token is required (401 otherwise).
 * - requireRole: the token must carry one of the given roles (403 otherwise).
 * App access tokens are stateless (15 min); sessions are checked when they refresh.
 */
const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../services/auth/token.service');
const { TOKEN_AUDIENCE } = require('../constants/enums');

/**
 * Read the token from `Authorization: Bearer <token>`.
 * @param {import('express').Request} req - Express request
 * @returns {string|null} Token or null
 */
const extractBearerToken = (req) => {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token.trim() : null;
};

/**
 * Require a logged-in buyer/seller. Sets `req.auth = { userId, roles, sessionId }`.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {Function} next - Next middleware
 */
const requireAuth = (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) return next(ApiError.unauthorized());

  try {
    const payload = verifyAccessToken(token, TOKEN_AUDIENCE.APP);
    req.auth = {
      userId: payload.sub,
      roles: Array.isArray(payload.roles) ? payload.roles : [],
      sessionId: payload.sid,
    };
    return next();
  } catch (err) {
    return next(err);
  }
};

/**
 * Read the app user if a valid token is sent, but never block the request (public pages
 * that behave a little differently for logged-in users). Sets `req.auth` or leaves it unset.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {Function} next - Next middleware
 */
const optionalAuth = (req, res, next) => {
  const token = extractBearerToken(req);
  if (token) {
    try {
      const payload = verifyAccessToken(token, TOKEN_AUDIENCE.APP);
      req.auth = {
        userId: payload.sub,
        roles: Array.isArray(payload.roles) ? payload.roles : [],
        sessionId: payload.sid,
      };
    } catch {
      // Expired or invalid token on a public route: continue as a guest
    }
  }
  next();
};

/**
 * Require at least one of the given app roles. Use after requireAuth.
 * @param {...string} roles - Allowed roles (APP_ROLE values)
 * @returns {Function} Express middleware
 */
const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.auth) return next(ApiError.unauthorized());
    const allowed = roles.some((role) => req.auth.roles.includes(role));
    return allowed ? next() : next(ApiError.forbidden());
  };

module.exports = { extractBearerToken, requireAuth, optionalAuth, requireRole };
