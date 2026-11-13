/**
 * Session service — creates logins, rotates refresh tokens and revokes sessions.
 *
 * Rotation (ACC-1): every refresh replaces the stored token hash atomically, so each
 * refresh token works exactly once. If an already-used token comes back, someone copied
 * it: the whole session is revoked (reuse detection) and the user must log in again.
 *
 * App sessions slide (30 days from the last refresh). Staff sessions are absolute
 * (8 hours from login) and also end after 30 minutes without activity (ADL-4).
 */
const { Types } = require('mongoose');
const Session = require('../../models/session.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { TOKEN_AUDIENCE } = require('../../constants/enums');
const {
  getAudienceConfig,
  signAccessToken,
  createRefreshToken,
  hashRefreshToken,
  parseRefreshToken,
} = require('./token.service');
const config = require('../../config/env');

const log = createLogger('SessionService');

// Only write lastActivityAt once a minute per session to keep staff requests cheap
const ACTIVITY_WRITE_INTERVAL_MS = 60 * 1000;

/** Error returned for any refresh token that cannot be used. */
const sessionEnded = (code = 'SESSION_ENDED') =>
  new ApiError(401, 'Your session has ended. Please log in again.', { code });

/**
 * Create a session and its first refresh token.
 * @param {Object} params
 * @param {string} params.userId - User id
 * @param {string} params.audience - TOKEN_AUDIENCE.APP or TOKEN_AUDIENCE.STAFF
 * @param {Object} [params.context] - `{ deviceId, ip, userAgent }`
 * @returns {Promise<{ session: Object, refreshToken: string }>}
 */
const createSession = async ({ userId, audience, context = {} }) => {
  const sessionId = new Types.ObjectId();
  const { token, hash } = createRefreshToken(sessionId, audience);
  const now = Date.now();

  const session = await Session.create({
    _id: sessionId,
    userId,
    audience,
    refreshTokenHash: hash,
    expiresAt: new Date(now + getAudienceConfig(audience).refreshTtlMs),
    lastActivityAt: new Date(now),
    deviceId: context.deviceId,
    ip: context.ip,
    userAgent: context.userAgent?.slice(0, 300),
  });

  return { session, refreshToken: token };
};

/**
 * Revoke one session.
 * @param {string} sessionId - Session id
 * @param {string} reason - logout | reuse_detected | idle_timeout | suspended | admin
 * @returns {Promise<void>}
 */
const revokeSession = async (sessionId, reason) => {
  await Session.updateOne(
    { _id: sessionId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
};

/**
 * Revoke every open session of a user (account suspended, staff removed).
 * @param {string} userId - User id
 * @param {string} reason - suspended | admin | staff_removed
 * @returns {Promise<number>} Sessions revoked
 */
const revokeUserSessions = async (userId, reason) => {
  const result = await Session.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
  return result.modifiedCount;
};

/**
 * Exchange a refresh token for a new one (single use).
 * @param {string} refreshToken - Current refresh token from the client
 * @param {string} audience - Expected audience
 * @param {Object} [context] - `{ ip }` of the caller
 * @returns {Promise<{ session: Object, refreshToken: string }>} Updated session + new token
 * @throws {ApiError} 401 SESSION_ENDED / SESSION_IDLE / REFRESH_TOKEN_REUSED
 */
const rotateRefreshToken = async (refreshToken, audience, context = {}) => {
  const sessionId = parseRefreshToken(refreshToken);
  if (!sessionId) throw sessionEnded('INVALID_REFRESH_TOKEN');

  const now = new Date();
  const hash = hashRefreshToken(refreshToken, audience);
  const next = createRefreshToken(sessionId, audience);
  const isStaff = audience === TOKEN_AUDIENCE.STAFF;
  const idleCutoff = new Date(now.getTime() - config.auth.staff.idleTimeoutMs);

  const filter = {
    _id: sessionId,
    audience,
    refreshTokenHash: hash,
    revokedAt: null,
    expiresAt: { $gt: now },
    // Staff: refreshing is not "activity", so an idle console cannot keep itself alive
    ...(isStaff ? { lastActivityAt: { $gt: idleCutoff } } : {}),
  };
  const update = {
    $set: {
      refreshTokenHash: next.hash,
      ip: context.ip,
      // App sessions slide; staff sessions keep their absolute 8 h expiry
      ...(isStaff ? {} : { expiresAt: new Date(now.getTime() + config.auth.app.refreshTtlMs) }),
    },
    $push: { usedTokenHashes: { $each: [hash], $slice: -Session.MAX_USED_HASHES } },
  };

  // Atomic compare-and-swap: two parallel refreshes with the same token cannot both win
  const session = await Session.findOneAndUpdate(filter, update, { returnDocument: 'after' });
  if (session) return { session, refreshToken: next.token };

  // Work out why it failed, for the right response and for security logging
  const existing = await Session.findOne({ _id: sessionId, audience }).select(
    '+usedTokenHashes +refreshTokenHash',
  );
  if (!existing || existing.revokedAt || existing.expiresAt <= now) throw sessionEnded();

  if (existing.usedTokenHashes.includes(hash)) {
    log.warn({ sessionId, userId: String(existing.userId) }, 'Refresh token reuse detected');
    await revokeSession(sessionId, 'reuse_detected');
    throw sessionEnded('REFRESH_TOKEN_REUSED');
  }
  if (isStaff && existing.lastActivityAt <= idleCutoff) {
    await revokeSession(sessionId, 'idle_timeout');
    throw sessionEnded('SESSION_IDLE');
  }
  throw sessionEnded('INVALID_REFRESH_TOKEN');
};

/**
 * Revoke the session behind a refresh token (logout). Unknown tokens are ignored so
 * logout always succeeds from the client's point of view.
 * @param {string} refreshToken - Refresh token
 * @param {string} audience - Token audience
 * @returns {Promise<void>}
 */
const revokeByRefreshToken = async (refreshToken, audience) => {
  const sessionId = parseRefreshToken(refreshToken);
  if (!sessionId) return;
  await Session.updateOne(
    { _id: sessionId, audience, refreshTokenHash: hashRefreshToken(refreshToken, audience) },
    { $set: { revokedAt: new Date(), revokedReason: 'logout' } },
  );
};

/**
 * Check a staff session on every staff API call: not revoked, not expired, not idle.
 * Records activity (at most once a minute).
 * @param {string} sessionId - Session id from the staff access token
 * @param {string} userId - User id from the token (must match the session)
 * @returns {Promise<Object>} The active session
 * @throws {ApiError} 401 SESSION_ENDED or SESSION_IDLE
 */
const assertStaffSessionActive = async (sessionId, userId) => {
  const now = Date.now();
  const session = await Session.findOne({ _id: sessionId, audience: TOKEN_AUDIENCE.STAFF });

  if (
    !session ||
    String(session.userId) !== String(userId) ||
    session.revokedAt ||
    session.expiresAt.getTime() <= now
  ) {
    throw sessionEnded();
  }

  if (now - session.lastActivityAt.getTime() > config.auth.staff.idleTimeoutMs) {
    await revokeSession(sessionId, 'idle_timeout');
    throw sessionEnded('SESSION_IDLE');
  }

  if (now - session.lastActivityAt.getTime() > ACTIVITY_WRITE_INTERVAL_MS) {
    await Session.updateOne({ _id: sessionId }, { $set: { lastActivityAt: new Date(now) } });
  }
  return session;
};

/**
 * Log a user in: create a session and return an access + refresh token pair.
 * @param {Object} params
 * @param {string} params.userId - User id
 * @param {string} params.audience - Token audience
 * @param {Object} params.claims - Access token claims (`roles` or `staffRole`)
 * @param {Object} [params.context] - `{ deviceId, ip, userAgent }`
 * @returns {Promise<{ accessToken: string, accessTokenExpiresAt: Date, refreshToken: string,
 *   refreshTokenExpiresAt: Date, sessionId: string }>}
 */
const startSession = async ({ userId, audience, claims, context }) => {
  const { session, refreshToken } = await createSession({ userId, audience, context });
  const access = signAccessToken({ userId, sessionId: session._id, audience, claims });
  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshToken,
    refreshTokenExpiresAt: session.expiresAt,
    sessionId: String(session._id),
  };
};

module.exports = {
  createSession,
  rotateRefreshToken,
  revokeSession,
  revokeUserSessions,
  revokeByRefreshToken,
  assertStaffSessionActive,
  startSession,
};
