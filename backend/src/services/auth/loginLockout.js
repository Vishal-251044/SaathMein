/**
 * Password login lockout, shared by staff (ADL-4) and dealer logins:
 * five wrong attempts lock the account for 15 minutes.
 */
const User = require('../../models/user.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');

const log = createLogger('LoginLockout');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

/**
 * Next failed-attempt state (pure, so it is easy to test).
 * @param {{ failedLoginCount?: number }} user - Current state
 * @param {number} [now=Date.now()] - Current time in ms
 * @returns {{ failedLoginCount: number, lockUntil: Date|null }} New state
 */
const nextFailedAttemptState = (user, now = Date.now()) => {
  const failedLoginCount = (user.failedLoginCount || 0) + 1;
  if (failedLoginCount >= MAX_FAILED_ATTEMPTS) {
    return { failedLoginCount: 0, lockUntil: new Date(now + LOCK_DURATION_MS) };
  }
  return { failedLoginCount, lockUntil: null };
};

/**
 * Throw if the account is locked.
 * @param {Object} user - User with lockUntil selected
 * @throws {ApiError} 429 ACCOUNT_LOCKED
 */
const assertNotLocked = (user) => {
  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    const retryAfterSeconds = Math.ceil((user.lockUntil.getTime() - Date.now()) / 1000);
    throw new ApiError(429, 'Too many failed attempts. This account is locked for 15 minutes.', {
      code: 'ACCOUNT_LOCKED',
      details: { retryAfterSeconds },
    });
  }
};

/**
 * Record a failed attempt; locks the account at the limit.
 * @param {Object} user - User document
 * @param {string} reason - e.g. "password", "2fa" (for logs)
 * @returns {Promise<void>}
 */
const registerFailure = async (user, reason) => {
  const state = nextFailedAttemptState(user);
  await User.updateOne({ _id: user._id }, { $set: state });
  log.warn(
    { userId: String(user._id), reason, locked: Boolean(state.lockUntil) },
    'Login attempt failed',
  );
};

/**
 * Clear failed attempts after a successful login.
 * @param {Object} user - User document
 * @returns {Promise<void>}
 */
const clearFailures = (user) =>
  User.updateOne(
    { _id: user._id },
    { $set: { failedLoginCount: 0, lockUntil: null, lastLoginAt: new Date() } },
  );

module.exports = {
  MAX_FAILED_ATTEMPTS,
  LOCK_DURATION_MS,
  nextFailedAttemptState,
  assertNotLocked,
  registerFailure,
  clearFailures,
};
