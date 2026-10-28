/**
 * Token service — signs and verifies JWT access tokens and builds opaque refresh tokens.
 *
 * - Access tokens: short-lived HS256 JWTs, one secret + audience per surface
 *   (app = buyer/seller, staff = admin console). A token is only valid for its audience.
 * - Refresh tokens: `<sessionId>.<random>` opaque strings. Only a keyed hash is stored
 *   (see session.service.js), so a database leak does not expose usable tokens.
 */
const jwt = require('jsonwebtoken');
const config = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { randomToken, hmacSha256 } = require('../../utils/crypto');
const { TOKEN_AUDIENCE } = require('../../constants/enums');

const ISSUER = 'saathmein-api';
const ALGORITHM = 'HS256';
const CHALLENGE_TTL_SECONDS = 5 * 60; // time allowed between password and 2FA steps

/** Secrets and lifetimes per audience. */
const AUDIENCE_CONFIG = {
  [TOKEN_AUDIENCE.APP]: config.auth.app,
  [TOKEN_AUDIENCE.STAFF]: config.auth.staff,
};

/**
 * Get the auth config for an audience.
 * @param {string} audience - TOKEN_AUDIENCE.APP or TOKEN_AUDIENCE.STAFF
 * @returns {{ accessSecret: string, refreshSecret: string, accessTtlMs: number, refreshTtlMs: number }}
 * @throws {Error} For an unknown audience (programming error)
 */
const getAudienceConfig = (audience) => {
  const audienceConfig = AUDIENCE_CONFIG[audience];
  if (!audienceConfig) throw new Error(`[TokenService] Unknown token audience: ${audience}`);
  return audienceConfig;
};

/**
 * Sign an access token.
 * @param {Object} params
 * @param {string} params.userId - User id (JWT subject)
 * @param {string} params.sessionId - Session id, so the token can be tied to a revocable login
 * @param {string} params.audience - TOKEN_AUDIENCE.APP or TOKEN_AUDIENCE.STAFF
 * @param {Object} [params.claims] - Extra claims: `roles` (app) or `staffRole` (staff)
 * @returns {{ token: string, expiresAt: Date }} Signed token and its expiry
 */
const signAccessToken = ({ userId, sessionId, audience, claims = {} }) => {
  const { accessSecret, accessTtlMs } = getAudienceConfig(audience);
  const expiresInSeconds = Math.floor(accessTtlMs / 1000);

  const token = jwt.sign({ ...claims, sid: String(sessionId) }, accessSecret, {
    subject: String(userId),
    audience,
    issuer: ISSUER,
    expiresIn: expiresInSeconds,
    algorithm: ALGORITHM,
  });

  return { token, expiresAt: new Date(Date.now() + expiresInSeconds * 1000) };
};

/**
 * Verify an access token for one audience.
 * @param {string} token - JWT from the Authorization header
 * @param {string} audience - Expected audience
 * @returns {Object} Decoded payload (`sub`, `sid`, `roles` / `staffRole`, ...)
 * @throws {ApiError} 401 TOKEN_EXPIRED or INVALID_TOKEN
 */
const verifyAccessToken = (token, audience) => {
  const { accessSecret } = getAudienceConfig(audience);
  try {
    return jwt.verify(token, accessSecret, {
      audience,
      issuer: ISSUER,
      algorithms: [ALGORITHM],
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Your session expired. Please refresh.', { code: 'TOKEN_EXPIRED' });
    }
    throw new ApiError(401, 'Invalid access token', { code: 'INVALID_TOKEN' });
  }
};

/**
 * Check whether a token is a valid buyer/seller app token (used to answer 403, not 401,
 * when an app user calls a staff-only API).
 * @param {string} token - JWT
 * @returns {boolean} True for a valid, unexpired app token
 */
const isValidAppToken = (token) => {
  try {
    verifyAccessToken(token, TOKEN_AUDIENCE.APP);
    return true;
  } catch {
    return false;
  }
};

/**
 * Sign the short-lived token that links the password step to the 2FA step (ADL-2).
 * @param {string} userId - Staff user id
 * @param {'verify'|'setup'} purpose - Verify an existing authenticator, or set one up
 * @returns {string} Signed challenge token (valid 5 minutes)
 */
const signChallengeToken = (userId, purpose) =>
  jwt.sign({ purpose }, config.auth.staff.accessSecret, {
    subject: String(userId),
    audience: TOKEN_AUDIENCE.STAFF_2FA,
    issuer: ISSUER,
    expiresIn: CHALLENGE_TTL_SECONDS,
    algorithm: ALGORITHM,
  });

/**
 * Verify a 2FA challenge token.
 * @param {string} token - Challenge token from the login step
 * @returns {{ userId: string, purpose: 'verify'|'setup' }} Decoded challenge
 * @throws {ApiError} 401 CHALLENGE_EXPIRED when invalid or older than 5 minutes
 */
const verifyChallengeToken = (token) => {
  try {
    const payload = jwt.verify(token, config.auth.staff.accessSecret, {
      audience: TOKEN_AUDIENCE.STAFF_2FA,
      issuer: ISSUER,
      algorithms: [ALGORITHM],
    });
    return { userId: payload.sub, purpose: payload.purpose };
  } catch {
    throw new ApiError(401, 'Your login step expired. Please sign in again.', {
      code: 'CHALLENGE_EXPIRED',
    });
  }
};

/**
 * Keyed hash of a refresh token (what the database stores).
 * @param {string} refreshToken - Opaque refresh token
 * @param {string} audience - Audience whose refresh secret is the key
 * @returns {string} Hex HMAC
 */
const hashRefreshToken = (refreshToken, audience) =>
  hmacSha256(refreshToken, getAudienceConfig(audience).refreshSecret);

/**
 * Create a new refresh token for a session.
 * @param {string} sessionId - Session the token belongs to
 * @param {string} audience - Token audience
 * @returns {{ token: string, hash: string }} Token for the client and hash for the database
 */
const createRefreshToken = (sessionId, audience) => {
  const token = `${sessionId}.${randomToken(32)}`;
  return { token, hash: hashRefreshToken(token, audience) };
};

/**
 * Read the session id from a refresh token without trusting it.
 * @param {string} refreshToken - Opaque refresh token
 * @returns {string|null} 24-char hex session id, or null if the format is wrong
 */
const parseRefreshToken = (refreshToken) => {
  const match = /^([a-f0-9]{24})\.[A-Za-z0-9_-]{40,}$/.exec(String(refreshToken || ''));
  return match ? match[1] : null;
};

module.exports = {
  ISSUER,
  getAudienceConfig,
  signAccessToken,
  verifyAccessToken,
  isValidAppToken,
  signChallengeToken,
  verifyChallengeToken,
  hashRefreshToken,
  createRefreshToken,
  parseRefreshToken,
};
