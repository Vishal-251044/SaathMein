/**
 * Home feed and wallet / referral — /api/feed/home, /api/users/me/wallet,
 * /api/users/me/referral (DIS-1, REF-1 to REF-3).
 */
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const feedService = require('../services/feed/feed.service');
const walletService = require('../services/wallet/wallet.service');
const referralService = require('../services/wallet/referral.service');

/** GET /api/feed/home?cityId= */
const homeFeed = asyncHandler(async (req, res) => {
  const feed = await feedService.getHomeFeed({ userId: req.auth?.userId }, req.validatedQuery);
  return sendSuccess(res, { message: 'Feed fetched', data: feed });
});

/** GET /api/users/me/wallet */
const wallet = asyncHandler(async (req, res) => {
  const { meta, ...data } = await walletService.getWallet(req.auth.userId, req.validatedQuery);
  return sendSuccess(res, { message: 'Wallet fetched', data, meta });
});

/** GET /api/users/me/referral */
const referral = asyncHandler(async (req, res) => {
  const data = await referralService.getReferral(req.auth.userId);
  return sendSuccess(res, { message: 'Referral fetched', data: { referral: data } });
});

/** POST /api/users/me/referral { code } */
const applyReferral = asyncHandler(async (req, res) => {
  const data = await referralService.applyReferralCode(req.auth.userId, req.body.code);
  return sendSuccess(res, { message: 'Referral code added', data: { referral: data } });
});

module.exports = { homeFeed, wallet, referral, applyReferral };
