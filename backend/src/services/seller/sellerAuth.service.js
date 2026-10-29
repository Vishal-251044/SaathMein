/**
 * Dealer auth (PRD §10.10, F30): sign up, email + password login, email verification and
 * accepting a team invite. Sessions are app sessions (same audience as the buyer app) with
 * the "seller" role; the dealer web keeps the refresh token in an httpOnly cookie.
 *
 * Phone: stored as the business contact only (not a login), because it is not OTP-verified
 * on the web — so nobody can register a dealer account on someone else's phone number.
 */
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../../models/user.model');
const Seller = require('../../models/seller.model');
const SellerStaff = require('../../models/sellerStaff.model');
const SellerInvite = require('../../models/sellerInvite.model');
const config = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { hmacSha256, safeEqual } = require('../../utils/crypto');
const { createLogger } = require('../../utils/logger');
const { ACCOUNT_STATUS, TOKEN_AUDIENCE } = require('../../constants/enums');
const {
  startSession,
  rotateRefreshToken,
  revokeByRefreshToken,
} = require('../auth/session.service');
const { signAccessToken } = require('../auth/token.service');
const { assertNotLocked, registerFailure, clearFailures } = require('../auth/loginLockout');
const { getAppRoles, getUserById } = require('../user.service');
const { assertWithinLimit } = require('../rateLimit.service');
const emailService = require('../email.service');

const log = createLogger('SellerAuth');

const BCRYPT_ROUNDS = 12;
const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const RESEND_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };

let dummyHashPromise = null;
/** Hash compared against when the email is unknown, so timing does not reveal accounts. */
const getDummyHash = () => {
  dummyHashPromise ??= bcrypt.hash('saathmein-dealer-timing-equaliser', BCRYPT_ROUNDS);
  return dummyHashPromise;
};

const invalidCredentials = () =>
  new ApiError(401, 'Email or password is incorrect', { code: 'INVALID_CREDENTIALS' });

/** @param {string} invitationToken @returns {string} Stored hash of an invite token */
const hashInviteToken = (invitationToken) =>
  hmacSha256(invitationToken, config.auth.app.refreshSecret);

/** @param {string} code @returns {string} Stored hash of an email code */
const hashEmailCode = (code) => hmacSha256(code, config.auth.app.refreshSecret);

/**
 * Shape of the logged-in dealer user.
 * @param {Object} user - User document
 * @returns {Object}
 */
const toDealerUser = (user) => ({
  id: String(user._id),
  name: user.name || null,
  email: user.email,
  emailVerified: Boolean(user.emailVerifiedAt),
});

/**
 * Start an app session with current roles.
 * @param {Object} user - User document
 * @param {Object} context - `{ ip, userAgent }`
 * @returns {Promise<Object>} Token pair
 */
const startDealerSession = async (user, context) =>
  startSession({
    userId: user._id,
    audience: TOKEN_AUDIENCE.APP,
    claims: { roles: await getAppRoles(user) },
    context,
  });

/**
 * Send (or re-send) the 6-digit email verification code.
 * @param {Object} user - User document
 * @returns {Promise<{ sent: boolean, devLogged?: boolean }>}
 */
const sendVerificationCode = async (user) => {
  await assertWithinLimit({
    key: `email-code:${user._id}`,
    ...RESEND_LIMIT,
    message: 'Too many codes requested. Please wait an hour and try again.',
    code: 'EMAIL_CODE_LIMIT',
  });
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        emailVerification: {
          codeHash: hashEmailCode(code),
          expiresAt: new Date(Date.now() + CODE_TTL_MS),
          attempts: 0,
          sentAt: new Date(),
        },
      },
    },
  );
  return emailService.sendEmailVerificationCode({ to: user.email, name: user.name, code });
};

/**
 * Register a dealer: user (email + password), seller (business), owner membership.
 * @param {{ name: string, email: string, password: string, businessName: string, phone: string }} input
 * @param {Object} context - `{ ip, userAgent }`
 * @returns {Promise<{ user: Object, tokens: Object }>}
 * @throws {ApiError} 409 EMAIL_TAKEN
 */
const registerDealer = async ({ name, email, password, businessName, phone }, context) => {
  if (await User.exists({ email })) {
    throw ApiError.conflict('An account with this email already exists. Please log in.', {
      code: 'EMAIL_TAKEN',
    });
  }

  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
  });
  try {
    const seller = await Seller.create({
      ownerUserId: user._id,
      businessName,
      contactName: name,
      contactEmail: email,
      contactPhone: phone,
    });
    await SellerStaff.create({ sellerId: seller._id, userId: user._id, role: 'owner' });
  } catch (err) {
    // Keep things consistent: no half-created dealer accounts
    await User.deleteOne({ _id: user._id });
    throw err;
  }

  await sendVerificationCode(user).catch((err) =>
    log.error({ err: err.message }, 'Verification email failed'),
  );
  const tokens = await startDealerSession(user, context);
  log.info({ userId: String(user._id) }, 'Dealer registered');
  return { user: toDealerUser(user), tokens };
};

/**
 * Email + password login for dealers (and their staff).
 * @param {{ email: string, password: string }} credentials
 * @param {Object} context - `{ ip, userAgent }`
 * @returns {Promise<{ user: Object, tokens: Object }>}
 * @throws {ApiError} 401 INVALID_CREDENTIALS, 403 NOT_A_DEALER / ACCOUNT_SUSPENDED, 429 ACCOUNT_LOCKED
 */
const loginDealer = async ({ email, password }, context) => {
  const user = await User.findOne({ email }).select('+passwordHash +failedLoginCount +lockUntil');
  if (!user || !user.passwordHash || user.staffRole) {
    await bcrypt.compare(password, await getDummyHash());
    throw invalidCredentials();
  }
  assertNotLocked(user);
  if (user.status !== ACCOUNT_STATUS.ACTIVE) {
    throw new ApiError(403, 'This account is not active. Contact SaathMein support.', {
      code: 'ACCOUNT_SUSPENDED',
    });
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    await registerFailure(user, 'dealer-password');
    throw invalidCredentials();
  }
  if (!(await SellerStaff.exists({ userId: user._id, status: 'active' }))) {
    throw new ApiError(403, 'This account is not part of a dealer team.', { code: 'NOT_A_DEALER' });
  }

  await clearFailures(user);
  return { user: toDealerUser(user), tokens: await startDealerSession(user, context) };
};

/**
 * Rotate the dealer refresh cookie and issue a new access token with current roles.
 * @param {string} refreshToken - From the httpOnly cookie
 * @param {Object} context - `{ ip }`
 * @returns {Promise<{ user: Object, tokens: Object }>}
 */
const refreshDealerSession = async (refreshToken, context) => {
  const { session, refreshToken: nextRefreshToken } = await rotateRefreshToken(
    refreshToken,
    TOKEN_AUDIENCE.APP,
    context,
  );
  const user = await getUserById(session.userId);
  if (user.status !== ACCOUNT_STATUS.ACTIVE) {
    throw new ApiError(401, 'Your session has ended. Please log in again.', {
      code: 'SESSION_ENDED',
    });
  }
  const access = signAccessToken({
    userId: user._id,
    sessionId: session._id,
    audience: TOKEN_AUDIENCE.APP,
    claims: { roles: await getAppRoles(user) },
  });
  return {
    user: toDealerUser(user),
    tokens: {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: nextRefreshToken,
      refreshTokenExpiresAt: session.expiresAt,
    },
  };
};

/** @param {string} refreshToken @returns {Promise<void>} End the dealer session */
const logoutDealer = (refreshToken) => revokeByRefreshToken(refreshToken, TOKEN_AUDIENCE.APP);

/**
 * Re-send the email code for the logged-in dealer.
 * @param {string} userId - User id
 * @returns {Promise<Object>} Send result
 */
const resendEmailCode = async (userId) => {
  const user = await getUserById(userId);
  if (user.emailVerifiedAt)
    throw ApiError.badRequest('Your email is already verified', { code: 'ALREADY_VERIFIED' });
  return sendVerificationCode(user);
};

/**
 * Check the 6-digit code from the email (5 attempts, 15 minutes).
 * @param {string} userId - User id
 * @param {string} code - Code typed by the dealer
 * @returns {Promise<Object>} Updated dealer user
 * @throws {ApiError} 400 INVALID_EMAIL_CODE / EMAIL_CODE_EXPIRED
 */
const verifyEmailCode = async (userId, code) => {
  const user = await User.findById(userId).select('+emailVerification');
  if (!user) throw ApiError.notFound('User not found');
  if (user.emailVerifiedAt) return toDealerUser(user);

  const pending = user.emailVerification;
  if (
    !pending?.codeHash ||
    pending.expiresAt < new Date() ||
    pending.attempts >= MAX_CODE_ATTEMPTS
  ) {
    throw ApiError.badRequest('This code has expired. Ask for a new one.', {
      code: 'EMAIL_CODE_EXPIRED',
    });
  }
  if (!safeEqual(pending.codeHash, hashEmailCode(code))) {
    await User.updateOne({ _id: user._id }, { $inc: { 'emailVerification.attempts': 1 } });
    throw ApiError.badRequest('That code is not correct.', { code: 'INVALID_EMAIL_CODE' });
  }

  user.emailVerifiedAt = new Date();
  user.emailVerification = undefined;
  await user.save();
  return toDealerUser(user);
};

/**
 * Find a pending, unexpired invite by its token.
 * @param {string} invitationToken - Token from the invite link
 * @returns {Promise<Object>} Invite with seller
 * @throws {ApiError} 404 INVITE_INVALID
 */
const findValidInvite = async (invitationToken) => {
  const invite = await SellerInvite.findOne({
    tokenHash: hashInviteToken(invitationToken),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  }).populate('sellerId', 'businessName status');
  if (!invite || !invite.sellerId) {
    throw ApiError.notFound('This invitation is no longer valid. Ask for a new one.', {
      code: 'INVITE_INVALID',
    });
  }
  return invite;
};

/**
 * Invite details for the accept page.
 * @param {string} invitationToken - Token from the link
 * @returns {Promise<{ businessName: string, email: string, name: string|null, hasAccount: boolean }>}
 */
const getInviteDetails = async (invitationToken) => {
  const invite = await findValidInvite(invitationToken);
  const hasAccount = Boolean(
    await User.exists({ email: invite.email, passwordHash: { $exists: true } }),
  );
  return {
    businessName: invite.sellerId.businessName,
    email: invite.email,
    name: invite.name || null,
    hasAccount,
  };
};

/**
 * Accept an invite: create the staff user (or confirm an existing dealer account's password)
 * and add them to the team.
 * @param {{ token: string, name?: string, password: string }} input
 * @param {Object} context - `{ ip, userAgent }`
 * @returns {Promise<{ user: Object, tokens: Object }>}
 */
const acceptInvite = async ({ token, name, password }, context) => {
  const invite = await findValidInvite(token);
  let user = await User.findOne({ email: invite.email }).select(
    '+passwordHash +failedLoginCount +lockUntil',
  );

  if (user?.staffRole)
    throw ApiError.conflict('Staff accounts cannot join dealer teams', { code: 'EMAIL_TAKEN' });
  if (user?.passwordHash) {
    assertNotLocked(user);
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      await registerFailure(user, 'invite-password');
      throw invalidCredentials();
    }
  } else if (user) {
    user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    if (name) user.name = name;
    user.emailVerifiedAt ??= new Date(); // the invite link proved the email
    await user.save();
  } else {
    user = await User.create({
      name: name || invite.name,
      email: invite.email,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      emailVerifiedAt: new Date(),
    });
  }

  // One dealer team per person (requireSeller resolves a single team); this also stops an
  // owner from being downgraded to staff by accepting an invite to their own team
  if (await SellerStaff.exists({ userId: user._id, status: 'active' })) {
    throw ApiError.conflict('This account is already part of a dealer team', {
      code: 'ALREADY_MEMBER',
    });
  }

  await SellerStaff.updateOne(
    { sellerId: invite.sellerId._id, userId: user._id },
    {
      $set: { role: 'staff', status: 'active', invitedBy: invite.invitedBy },
      $unset: { removedAt: 1 },
    },
    { upsert: true },
  );
  invite.status = 'accepted';
  invite.acceptedBy = user._id;
  invite.acceptedAt = new Date();
  await invite.save();

  return { user: toDealerUser(user), tokens: await startDealerSession(user, context) };
};

module.exports = {
  hashInviteToken,
  toDealerUser,
  registerDealer,
  loginDealer,
  refreshDealerSession,
  logoutDealer,
  resendEmailCode,
  verifyEmailCode,
  getInviteDetails,
  acceptInvite,
};
