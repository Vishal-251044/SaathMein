/**
 * App auth controller — /api/auth/* for the buyer app (and dealers from Day 5).
 */
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const authService = require('../services/auth/auth.service');

/**
 * Request context saved on the session (device and network info).
 * @param {import('express').Request} req - Express request
 * @returns {{ deviceId?: string, ip: string, userAgent?: string }}
 */
const getRequestContext = (req) => ({
  deviceId: req.body?.deviceId,
  ip: req.ip,
  userAgent: req.get('user-agent'),
});

/** POST /api/auth/otp/request — check OTP abuse limits before Firebase sends the SMS. */
const requestOtp = asyncHandler(async (req, res) => {
  const data = await authService.requestOtp({
    phone: req.body.phone,
    deviceId: req.body.deviceId,
    ip: req.ip,
  });
  return sendSuccess(res, { message: 'You can request an OTP now', data });
});

/** POST /api/auth/otp/verify — exchange a Firebase ID token for SaathMein tokens. */
const verifyOtp = asyncHandler(async (req, res) => {
  const data = await authService.verifyOtpLogin({
    idToken: req.body.idToken,
    context: getRequestContext(req),
  });
  return sendSuccess(res, { message: 'Logged in', data });
});

/** POST /api/auth/refresh — rotate the refresh token. */
const refresh = asyncHandler(async (req, res) => {
  const tokens = await authService.refreshAppSession(req.body.refreshToken, { ip: req.ip });
  return sendSuccess(res, { message: 'Session refreshed', data: { tokens } });
});

/** POST /api/auth/logout — end this device's session. */
const logout = asyncHandler(async (req, res) => {
  await authService.logoutApp(req.body.refreshToken);
  return sendSuccess(res, { message: 'Logged out' });
});

/** GET /api/auth/me — the logged-in user. */
const getMe = asyncHandler(async (req, res) => {
  const data = await authService.getCurrentUser(req.auth.userId);
  return sendSuccess(res, { message: 'User fetched', data });
});

module.exports = { requestOtp, verifyOtp, refresh, logout, getMe };
