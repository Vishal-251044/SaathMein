/**
 * App auth service — buyer/seller phone OTP login (PRD §10.1, ACC-1, ACC-4).
 *
 * Flow:
 * 1. App asks POST /auth/otp/request → we apply abuse limits (3 per 10 min per number).
 * 2. App asks Firebase to send the SMS and confirms the code with Firebase.
 * 3. App sends the Firebase ID token to POST /auth/otp/verify → we verify it, find or
 *    create the user and issue our own access (15 min) + refresh (30 days) tokens.
 */
const User = require('../../models/user.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { maskPhone } = require('../../helpers/genericFunctions');
const { ACCOUNT_STATUS, TOKEN_AUDIENCE } = require('../../constants/enums');
const { assertWithinLimit } = require('../rateLimit.service');
const { verifyPhoneIdToken } = require('./firebase.service');
const { startSession, rotateRefreshToken, revokeByRefreshToken } = require('./session.service');
const { signAccessToken } = require('./token.service');
const { toAppUser, getAppRoles, getUserById } = require('../user.service');

const log = createLogger('AuthService');

const TEN_MINUTES_MS = 10 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

/** OTP abuse limits (ACC-4). Phone limit is from the PRD; device/IP limits stop number cycling. */
const OTP_LIMITS = {
  phone: { limit: 3, windowMs: TEN_MINUTES_MS },
  device: { limit: 5, windowMs: TEN_MINUTES_MS },
  ip: { limit: 20, windowMs: ONE_HOUR_MS },
};

/** Indian mobile numbers only at launch: +91 followed by 10 digits starting 6–9. */
const INDIAN_MOBILE_REGEX = /^\+91[6-9]\d{9}$/;

/**
 * Throw if an account cannot log in.
 * @param {Object} user - User document
 * @throws {ApiError} 403 ACCOUNT_SUSPENDED / ACCOUNT_DELETED
 */
const assertCanLogin = (user) => {
  if (user.status === ACCOUNT_STATUS.SUSPENDED) {
    throw new ApiError(403, 'This account is suspended. Please contact SaathMein support.', {
      code: 'ACCOUNT_SUSPENDED',
    });
  }
  if (user.status === ACCOUNT_STATUS.DELETED) {
    throw new ApiError(403, 'This account was deleted.', { code: 'ACCOUNT_DELETED' });
  }
};

/**
 * Check abuse limits before the app asks Firebase to send an OTP SMS.
 * @param {Object} params
 * @param {string} params.phone - E.164 phone, e.g. +919876543210
 * @param {string} [params.deviceId] - App install id
 * @param {string} [params.ip] - Caller IP
 * @returns {Promise<{ phone: string }>} The approved phone number
 * @throws {ApiError} 422 for non-Indian numbers, 403 for suspended accounts, 429 when over limit
 */
const requestOtp = async ({ phone, deviceId, ip }) => {
  if (!INDIAN_MOBILE_REGEX.test(phone)) {
    throw new ApiError(422, 'Enter a valid 10-digit Indian mobile number', {
      code: 'INVALID_PHONE',
    });
  }

  const message = 'Too many OTP requests. Please wait a few minutes and try again.';
  await assertWithinLimit({
    key: `otp:phone:${phone}`,
    ...OTP_LIMITS.phone,
    message,
    code: 'OTP_LIMIT',
  });
  if (deviceId) {
    await assertWithinLimit({
      key: `otp:device:${deviceId}`,
      ...OTP_LIMITS.device,
      message,
      code: 'OTP_LIMIT',
    });
  }
  if (ip) {
    await assertWithinLimit({ key: `otp:ip:${ip}`, ...OTP_LIMITS.ip, message, code: 'OTP_LIMIT' });
  }

  const existing = await User.findOne({ phone }).select('status');
  if (existing) assertCanLogin(existing);

  log.info({ phone: maskPhone(phone), deviceId }, 'OTP request allowed');
  return { phone };
};

/**
 * Find the user for a verified phone, or create one.
 * @param {{ uid: string, phone: string }} identity - Verified Firebase identity
 * @param {string} [deviceId] - App install id
 * @returns {Promise<{ user: Object, isNewUser: boolean }>}
 */
const findOrCreateUser = async ({ uid, phone }, deviceId) => {
  const existing = await User.findOne({ $or: [{ firebaseUid: uid }, { phone }] });
  if (existing) return { user: existing, isNewUser: false };

  try {
    const user = await User.create({
      phone,
      firebaseUid: uid,
      deviceIds: deviceId ? [deviceId] : [],
    });
    return { user, isNewUser: true };
  } catch (err) {
    // Two verify calls for a brand-new number at the same moment: the second one loses
    if (err?.code === 11000) {
      return { user: await User.findOne({ phone }), isNewUser: false };
    }
    throw err;
  }
};

/**
 * Log in with a Firebase phone ID token and issue SaathMein tokens.
 * @param {Object} params
 * @param {string} params.idToken - Firebase ID token
 * @param {Object} params.context - `{ deviceId, ip, userAgent }`
 * @returns {Promise<{ user: Object, isNewUser: boolean, tokens: Object }>}
 */
const verifyOtpLogin = async ({ idToken, context }) => {
  const identity = await verifyPhoneIdToken(idToken);
  if (!INDIAN_MOBILE_REGEX.test(identity.phone)) {
    throw new ApiError(422, 'Only Indian mobile numbers are supported right now', {
      code: 'INVALID_PHONE',
    });
  }

  const { user, isNewUser } = await findOrCreateUser(identity, context.deviceId);
  assertCanLogin(user);

  const updates = { lastLoginAt: new Date() };
  if (!user.firebaseUid) updates.firebaseUid = identity.uid;
  await User.updateOne(
    { _id: user._id },
    { $set: updates, ...(context.deviceId ? { $addToSet: { deviceIds: context.deviceId } } : {}) },
  );

  const tokens = await startSession({
    userId: user._id,
    audience: TOKEN_AUDIENCE.APP,
    claims: { roles: await getAppRoles(user) },
    context,
  });

  log.info(
    { userId: String(user._id), isNewUser, phone: maskPhone(identity.phone) },
    'User logged in',
  );
  return { user: toAppUser(user), isNewUser, tokens };
};

/**
 * Rotate an app refresh token and issue a new access token.
 * @param {string} refreshToken - Current refresh token
 * @param {Object} context - `{ ip }`
 * @returns {Promise<Object>} New token pair
 * @throws {ApiError} 401 when the session ended, 403 when the account is suspended
 */
const refreshAppSession = async (refreshToken, context) => {
  const { session, refreshToken: nextRefreshToken } = await rotateRefreshToken(
    refreshToken,
    TOKEN_AUDIENCE.APP,
    context,
  );
  const user = await getUserById(session.userId);
  assertCanLogin(user);

  const access = signAccessToken({
    userId: user._id,
    sessionId: session._id,
    audience: TOKEN_AUDIENCE.APP,
    claims: { roles: await getAppRoles(user) },
  });

  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshToken: nextRefreshToken,
    refreshTokenExpiresAt: session.expiresAt,
    sessionId: String(session._id),
  };
};

/**
 * Log out of the app (revoke this device's session).
 * @param {string} refreshToken - Refresh token of the session to end
 * @returns {Promise<void>}
 */
const logoutApp = (refreshToken) => revokeByRefreshToken(refreshToken, TOKEN_AUDIENCE.APP);

/**
 * Current user's profile.
 * @param {string} userId - Id from the access token
 * @returns {Promise<{ user: Object, roles: string[] }>}
 */
const getCurrentUser = async (userId) => {
  const user = await getUserById(userId);
  assertCanLogin(user);
  return { user: toAppUser(user), roles: await getAppRoles(user) };
};

module.exports = {
  OTP_LIMITS,
  INDIAN_MOBILE_REGEX,
  requestOtp,
  verifyOtpLogin,
  refreshAppSession,
  logoutApp,
  getCurrentUser,
};
