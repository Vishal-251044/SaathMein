/**
 * Admin auth controller — /api/admin/auth/* for the Owner / Admin Console.
 * The staff refresh token lives in an httpOnly cookie (JavaScript can never read it);
 * the short-lived access token is returned in the body and kept in memory by the web app.
 */
const config = require('../../config/env');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/ApiResponse');
const { parseCookies } = require('../../utils/cookies');
const staffAuthService = require('../../services/auth/staffAuth.service');
const User = require('../../models/user.model');
const { toStaffUser } = require('../../services/user.service');
const { recordAudit } = require('../../services/audit.service');

const REFRESH_COOKIE = 'sm_staff_rt';
const REFRESH_COOKIE_PATH = '/api/admin/auth';

/** Base cookie attributes (clearCookie must use the same ones, without maxAge). */
const baseCookieOptions = () => ({
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'strict',
  path: REFRESH_COOKIE_PATH,
});

/** Cookie options for the staff refresh token. */
const refreshCookieOptions = () => ({
  ...baseCookieOptions(),
  maxAge: config.auth.staff.refreshTtlMs,
});

/**
 * Set the refresh cookie and return the body-safe part of the tokens.
 * @param {import('express').Response} res - Express response
 * @param {Object} tokens - Token pair from the service
 * @returns {{ accessToken: string, accessTokenExpiresAt: Date, sessionExpiresAt: Date }}
 */
const applySessionCookie = (res, tokens) => {
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions());
  return {
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    sessionExpiresAt: tokens.refreshTokenExpiresAt,
  };
};

/** Clear the refresh cookie. @param {import('express').Response} res */
const clearSessionCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE, baseCookieOptions());
};

/** POST /api/admin/auth/login — step 1: email + password. */
const login = asyncHandler(async (req, res) => {
  const data = await staffAuthService.loginWithPassword(req.body);
  return sendSuccess(res, { message: 'Password accepted. Enter your 2FA code.', data });
});

/** POST /api/admin/auth/2fa/verify — step 2: TOTP or backup code → session. */
const verifyTwoFactor = asyncHandler(async (req, res) => {
  const { staff, tokens, backupCodes } = await staffAuthService.verifySecondFactor({
    challengeToken: req.body.challengeToken,
    code: req.body.code,
    context: { ip: req.ip, userAgent: req.get('user-agent') },
  });
  const session = applySessionCookie(res, tokens);
  // Staff logins are recorded in the audit log (ADL-5); /auth runs before the audit middleware
  await recordAudit({
    actorId: staff.id,
    actorRole: staff.role,
    action: 'staff.login',
    targetType: 'staff',
    targetId: staff.id,
    method: req.method,
    path: req.originalUrl.split('?')[0],
    statusCode: 200,
    ip: req.ip,
    userAgent: req.get('user-agent')?.slice(0, 300),
    requestId: req.id,
  });
  return sendSuccess(res, {
    message: 'Logged in',
    data: { staff, ...session, ...(backupCodes ? { backupCodes } : {}) },
  });
});

/** POST /api/admin/auth/refresh — rotate the cookie and get a new access token. */
const refresh = asyncHandler(async (req, res) => {
  const refreshToken = parseCookies(req)[REFRESH_COOKIE];
  try {
    const { staff, tokens } = await staffAuthService.refreshStaffSession(refreshToken, {
      ip: req.ip,
    });
    const session = applySessionCookie(res, tokens);
    return sendSuccess(res, { message: 'Session refreshed', data: { staff, ...session } });
  } catch (err) {
    clearSessionCookie(res); // a dead session should not keep sending its cookie
    throw err;
  }
});

/** POST /api/admin/auth/logout — end the staff session. */
const logout = asyncHandler(async (req, res) => {
  const refreshToken = parseCookies(req)[REFRESH_COOKIE];
  const signedOut = refreshToken ? await staffAuthService.logoutStaff(refreshToken) : null;
  clearSessionCookie(res);
  // Staff sign-outs are audited too (ADL-5); /auth runs before the audit middleware
  if (signedOut) {
    await recordAudit({
      actorId: signedOut.userId,
      actorRole: signedOut.role,
      action: 'staff.logout',
      targetType: 'staff',
      targetId: signedOut.userId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      statusCode: 200,
      ip: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 300),
      requestId: req.id,
    });
  }
  return sendSuccess(res, { message: 'Logged out' });
});

/** GET /api/admin/auth/me — the logged-in staff member (requires requireStaff). */
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.staff.userId);
  return sendSuccess(res, { message: 'Staff fetched', data: { staff: toStaffUser(user) } });
});

module.exports = { REFRESH_COOKIE, login, verifyTwoFactor, refresh, logout, getMe };
