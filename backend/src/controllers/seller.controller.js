/**
 * Dealer dashboard controller — /api/seller/* (PRD §10.10, F30–F31, TRU-1).
 */
const config = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const { createRefreshCookie } = require('../utils/refreshCookie');
const sellerAuth = require('../services/seller/sellerAuth.service');
const sellerAccount = require('../services/seller/sellerAccount.service');
const sellerTeam = require('../services/seller/sellerTeam.service');
const { createProductRequest } = require('../services/productRequest.service');

const refreshCookie = createRefreshCookie({
  name: 'sm_seller_rt',
  path: '/api/seller/auth',
  maxAgeMs: config.auth.app.refreshTtlMs,
});

/** @param {import('express').Request} req @returns {Object} Session context */
const context = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

/**
 * Set the refresh cookie and return what the browser may keep in memory.
 * @param {import('express').Response} res - Express response
 * @param {Object} tokens - Token pair
 * @returns {{ accessToken: string, accessTokenExpiresAt: Date }}
 */
const applySession = (res, tokens) => {
  refreshCookie.set(res, tokens.refreshToken);
  return { accessToken: tokens.accessToken, accessTokenExpiresAt: tokens.accessTokenExpiresAt };
};

/* ---------------------------------- Auth ---------------------------------- */

/** POST /api/seller/auth/register */
const register = asyncHandler(async (req, res) => {
  const { user, tokens } = await sellerAuth.registerDealer(req.body, context(req));
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Account created',
    data: { user, ...applySession(res, tokens) },
  });
});

/** POST /api/seller/auth/login */
const login = asyncHandler(async (req, res) => {
  const { user, tokens } = await sellerAuth.loginDealer(req.body, context(req));
  return sendSuccess(res, { message: 'Logged in', data: { user, ...applySession(res, tokens) } });
});

/** POST /api/seller/auth/refresh (cookie) */
const refresh = asyncHandler(async (req, res) => {
  try {
    const { user, tokens } = await sellerAuth.refreshDealerSession(refreshCookie.read(req), {
      ip: req.ip,
    });
    return sendSuccess(res, {
      message: 'Session refreshed',
      data: { user, ...applySession(res, tokens) },
    });
  } catch (err) {
    refreshCookie.clear(res);
    throw err;
  }
});

/** POST /api/seller/auth/logout (cookie) */
const logout = asyncHandler(async (req, res) => {
  const token = refreshCookie.read(req);
  if (token) await sellerAuth.logoutDealer(token);
  refreshCookie.clear(res);
  return sendSuccess(res, { message: 'Logged out' });
});

/** POST /api/seller/auth/email/send-code */
const sendEmailCode = asyncHandler(async (req, res) => {
  const result = await sellerAuth.resendEmailCode(req.auth.userId);
  return sendSuccess(res, {
    message: 'Code sent',
    data: { sent: result.sent, devLogged: Boolean(result.devLogged) },
  });
});

/** POST /api/seller/auth/email/verify */
const verifyEmail = asyncHandler(async (req, res) => {
  const user = await sellerAuth.verifyEmailCode(req.auth.userId, req.body.code);
  return sendSuccess(res, { message: 'Email verified', data: { user } });
});

/** GET /api/seller/auth/invites/:token */
const getInvite = asyncHandler(async (req, res) => {
  const invite = await sellerAuth.getInviteDetails(req.params.token);
  return sendSuccess(res, { message: 'Invitation found', data: { invite } });
});

/** POST /api/seller/auth/invites/accept */
const acceptInvite = asyncHandler(async (req, res) => {
  const { user, tokens } = await sellerAuth.acceptInvite(req.body, context(req));
  return sendSuccess(res, {
    message: 'Welcome to the team',
    data: { user, ...applySession(res, tokens) },
  });
});

/* ------------------------------ Dealer account ----------------------------- */

/** GET /api/seller/me — dashboard data and onboarding checklist */
const getMe = asyncHandler(async (req, res) => {
  const seller = await sellerAccount.getMyDealer(req.seller);
  return sendSuccess(res, { message: 'Dealer fetched', data: { seller } });
});

/** PATCH /api/seller/profile (owner) */
const updateProfile = asyncHandler(async (req, res) => {
  const seller = await sellerAccount.updateDealerProfile(req.seller.sellerId, req.body);
  return sendSuccess(res, { message: 'Profile saved', data: { seller } });
});

/** POST /api/seller/kyc/upload-params (owner) */
const getKycUploadParams = asyncHandler(async (req, res) => {
  const data = await sellerAccount.getKycUploadParams(req.seller.sellerId, req.body.docType);
  return sendSuccess(res, { message: 'Upload authorised', data });
});

/** POST /api/seller/kyc (owner) */
const submitKyc = asyncHandler(async (req, res) => {
  const seller = await sellerAccount.submitKyc(req.seller.sellerId, req.auth.userId, req.body);
  return sendSuccess(res, { message: 'KYC submitted for review', data: { seller } });
});

/* ---------------------------------- Team ---------------------------------- */

/** GET /api/seller/team */
const getTeam = asyncHandler(async (req, res) => {
  const team = await sellerTeam.listTeam(req.seller.sellerId);
  return sendSuccess(res, { message: 'Team fetched', data: { team } });
});

/** POST /api/seller/team/invites (owner) */
const invite = asyncHandler(async (req, res) => {
  const team = await sellerTeam.inviteStaff(req.seller.sellerId, req.auth.userId, req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Invitation sent', data: { team } });
});

/** DELETE /api/seller/team/invites/:inviteId (owner) */
const revokeInvite = asyncHandler(async (req, res) => {
  const team = await sellerTeam.revokeInvite(req.seller.sellerId, req.params.inviteId);
  return sendSuccess(res, { message: 'Invitation cancelled', data: { team } });
});

/** DELETE /api/seller/team/members/:userId (owner) */
const removeMember = asyncHandler(async (req, res) => {
  const team = await sellerTeam.removeMember(req.seller.sellerId, req.params.userId);
  return sendSuccess(res, { message: 'Removed from the team', data: { team } });
});

/** POST /api/seller/product-requests — a dealer asks for a missing product */
const requestProduct = asyncHandler(async (req, res) => {
  const request = await createProductRequest(
    { userId: req.auth.userId, sellerId: req.seller.sellerId },
    req.body,
  );
  return sendSuccess(res, { statusCode: 201, message: 'Request sent', data: { request } });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  sendEmailCode,
  verifyEmail,
  getInvite,
  acceptInvite,
  getMe,
  updateProfile,
  getKycUploadParams,
  submitKyc,
  getTeam,
  invite,
  revokeInvite,
  removeMember,
  requestProduct,
};
