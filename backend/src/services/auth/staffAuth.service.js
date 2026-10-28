/**
 * Staff auth service — Owner / Admin Console login (PRD §10.11, ADL-1 to ADL-4).
 *
 * Step 1: email + password → a 5-minute challenge token.
 *   - First login (no authenticator yet): also returns a new TOTP secret to set up.
 * Step 2: 6-digit TOTP code (or a one-time backup code) + challenge token → staff session
 *   (access 15 min, refresh 8 h, ends after 30 min idle).
 * Five wrong passwords or codes lock the account for 15 minutes.
 */
const bcrypt = require('bcrypt');
const User = require('../../models/user.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { ACCOUNT_STATUS, TOKEN_AUDIENCE } = require('../../constants/enums');
const { signAccessToken, signChallengeToken, verifyChallengeToken } = require('./token.service');
const { startSession, rotateRefreshToken, revokeByRefreshToken } = require('./session.service');
const twoFactor = require('./twoFactor.service');
const { toStaffUser, getUserById } = require('../user.service');

const log = createLogger('StaffAuthService');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const BCRYPT_ROUNDS = 12;
// Compared against when the email does not exist, so response time does not reveal accounts.
// Generated once on first use (a real hash with the same cost as staff passwords).
let dummyHashPromise = null;
const getDummyHash = () => {
  dummyHashPromise ??= bcrypt.hash('saathmein-timing-equaliser', BCRYPT_ROUNDS);
  return dummyHashPromise;
};

const STAFF_SECRET_FIELDS =
  '+passwordHash +failedLoginCount +lockUntil +twoFactorSecret +twoFactorPendingSecret ' +
  '+twoFactorLastStep +twoFactorBackupCodes';

const invalidCredentials = () =>
  new ApiError(401, 'Email or password is incorrect', { code: 'INVALID_CREDENTIALS' });

/**
 * Hash a staff password.
 * @param {string} password - Plain password
 * @returns {Promise<string>} bcrypt hash
 */
const hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS);

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
 * Record a failed password or code. Locks the account at the limit.
 * @param {Object} user - User document
 * @param {string} reason - "password" or "2fa" (for logs)
 * @returns {Promise<void>}
 */
const registerFailure = async (user, reason) => {
  const state = nextFailedAttemptState(user);
  await User.updateOne({ _id: user._id }, { $set: state });
  log.warn(
    { userId: String(user._id), reason, locked: Boolean(state.lockUntil) },
    'Staff login attempt failed',
  );
};

/**
 * Load an active staff user with secret fields.
 * @param {Object} filter - Mongo filter
 * @returns {Promise<Object|null>} Staff user or null
 */
const findStaff = (filter) =>
  User.findOne({ ...filter, staffRole: { $exists: true } }).select(STAFF_SECRET_FIELDS);

/**
 * Step 1 — check email and password.
 * @param {Object} params
 * @param {string} params.email - Staff email
 * @param {string} params.password - Password
 * @returns {Promise<{ step: 'verify_2fa'|'setup_2fa', challengeToken: string,
 *   setup?: { secret: string, otpAuthUrl: string } }>}
 * @throws {ApiError} 401 INVALID_CREDENTIALS, 429 ACCOUNT_LOCKED, 403 ACCOUNT_SUSPENDED
 */
const loginWithPassword = async ({ email, password }) => {
  const user = await findStaff({ email: email.toLowerCase() });
  if (!user || !user.passwordHash) {
    await bcrypt.compare(password, await getDummyHash());
    throw invalidCredentials();
  }

  assertNotLocked(user);
  if (user.status !== ACCOUNT_STATUS.ACTIVE) {
    throw new ApiError(403, 'This staff account is not active', { code: 'ACCOUNT_SUSPENDED' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    await registerFailure(user, 'password');
    throw invalidCredentials();
  }

  if (user.twoFactorEnabled && user.twoFactorSecret) {
    return { step: 'verify_2fa', challengeToken: signChallengeToken(user._id, 'verify') };
  }

  // 2FA is mandatory (ADL-2): first login sets up an authenticator before any session exists
  const secret = twoFactor.createTotpSecret();
  await User.updateOne(
    { _id: user._id },
    { $set: { twoFactorPendingSecret: twoFactor.encryptSecret(secret) } },
  );
  return {
    step: 'setup_2fa',
    challengeToken: signChallengeToken(user._id, 'setup'),
    setup: { secret, otpAuthUrl: twoFactor.buildOtpAuthUrl(secret, user.email) },
  };
};

/**
 * Check the 2FA code for a challenge. Returns the database changes to apply on success.
 * @param {Object} user - Staff user with secret fields
 * @param {'verify'|'setup'} purpose - Challenge purpose
 * @param {string} code - TOTP or backup code
 * @returns {Promise<{ valid: boolean, updates?: Object, backupCodes?: string[] }>}
 */
const checkSecondFactor = async (user, purpose, code) => {
  if (purpose === 'setup') {
    if (!user.twoFactorPendingSecret) return { valid: false };
    const secret = twoFactor.decryptSecret(user.twoFactorPendingSecret);
    const result = await twoFactor.verifyTotpCode(secret, code);
    if (!result.valid) return { valid: false };

    const { codes, stored } = twoFactor.generateBackupCodes();
    return {
      valid: true,
      backupCodes: codes, // shown to the user once, never again
      updates: {
        $set: {
          twoFactorSecret: user.twoFactorPendingSecret,
          twoFactorEnabled: true,
          twoFactorLastStep: result.timeStep,
          twoFactorBackupCodes: stored,
        },
        $unset: { twoFactorPendingSecret: 1 },
      },
    };
  }

  if (!user.twoFactorEnabled || !user.twoFactorSecret) return { valid: false };

  if (twoFactor.isBackupCodeFormat(code)) {
    const index = twoFactor.findUnusedBackupCode(user.twoFactorBackupCodes, code);
    if (index === -1) return { valid: false };
    return {
      valid: true,
      updates: { $set: { [`twoFactorBackupCodes.${index}.usedAt`]: new Date() } },
    };
  }

  const secret = twoFactor.decryptSecret(user.twoFactorSecret);
  const result = await twoFactor.verifyTotpCode(secret, code, user.twoFactorLastStep);
  if (!result.valid) return { valid: false };
  return { valid: true, updates: { $set: { twoFactorLastStep: result.timeStep } } };
};

/**
 * Step 2 — verify the authenticator (or backup) code and start a staff session.
 * @param {Object} params
 * @param {string} params.challengeToken - Token from step 1
 * @param {string} params.code - 6-digit TOTP code or 8-character backup code
 * @param {Object} params.context - `{ ip, userAgent }`
 * @returns {Promise<{ staff: Object, tokens: Object, backupCodes?: string[] }>}
 * @throws {ApiError} 401 INVALID_2FA_CODE / CHALLENGE_EXPIRED, 429 ACCOUNT_LOCKED
 */
const verifySecondFactor = async ({ challengeToken, code, context }) => {
  const { userId, purpose } = verifyChallengeToken(challengeToken);
  const user = await findStaff({ _id: userId });
  if (!user || user.status !== ACCOUNT_STATUS.ACTIVE) throw invalidCredentials();
  assertNotLocked(user);

  const check = await checkSecondFactor(user, purpose, code);
  if (!check.valid) {
    await registerFailure(user, '2fa');
    throw new ApiError(401, 'That code is not valid. Check your authenticator app and try again.', {
      code: 'INVALID_2FA_CODE',
    });
  }

  const loginUpdates = {
    ...check.updates,
    $set: { ...check.updates.$set, failedLoginCount: 0, lockUntil: null, lastLoginAt: new Date() },
  };
  await User.updateOne({ _id: user._id }, loginUpdates);

  const tokens = await startSession({
    userId: user._id,
    audience: TOKEN_AUDIENCE.STAFF,
    claims: { staffRole: user.staffRole },
    context,
  });

  // TODO(Day 5): write this login to the audit log; new-device email alert when email exists
  log.info({ userId: String(user._id), role: user.staffRole, ip: context.ip }, 'Staff logged in');
  return { staff: toStaffUser(user), tokens, backupCodes: check.backupCodes };
};

/**
 * Rotate the staff refresh token (cookie) and issue a new access token.
 * @param {string} refreshToken - Refresh token from the httpOnly cookie
 * @param {Object} context - `{ ip }`
 * @returns {Promise<{ staff: Object, tokens: Object }>}
 * @throws {ApiError} 401 when the session ended or the user is no longer active staff
 */
const refreshStaffSession = async (refreshToken, context) => {
  const { session, refreshToken: nextRefreshToken } = await rotateRefreshToken(
    refreshToken,
    TOKEN_AUDIENCE.STAFF,
    context,
  );
  const user = await getUserById(session.userId);
  if (!user.staffRole || user.status !== ACCOUNT_STATUS.ACTIVE) {
    throw new ApiError(401, 'Your session has ended. Please log in again.', {
      code: 'SESSION_ENDED',
    });
  }

  const access = signAccessToken({
    userId: user._id,
    sessionId: session._id,
    audience: TOKEN_AUDIENCE.STAFF,
    claims: { staffRole: user.staffRole },
  });

  return {
    staff: toStaffUser(user),
    tokens: {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: nextRefreshToken,
      refreshTokenExpiresAt: session.expiresAt,
    },
  };
};

/**
 * End a staff session.
 * @param {string} refreshToken - Refresh token from the cookie
 * @returns {Promise<void>}
 */
const logoutStaff = (refreshToken) => revokeByRefreshToken(refreshToken, TOKEN_AUDIENCE.STAFF);

module.exports = {
  MAX_FAILED_ATTEMPTS,
  LOCK_DURATION_MS,
  hashPassword,
  nextFailedAttemptState,
  loginWithPassword,
  verifySecondFactor,
  refreshStaffSession,
  logoutStaff,
};
