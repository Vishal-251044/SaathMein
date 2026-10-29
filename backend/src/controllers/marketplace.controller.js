/**
 * Buyer-facing dealer endpoints — public verified sellers (TRU-1) and "request a missing
 * product" from the app (CAT-5).
 */
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const User = require('../models/user.model');
const { listVerifiedSellers } = require('../services/seller/sellerPublic.service');
const { createProductRequest } = require('../services/productRequest.service');

/** GET /api/sellers?cityId=&categoryId=&latitude=&longitude= */
const listSellers = asyncHandler(async (req, res) => {
  const sellers = await listVerifiedSellers(req.validatedQuery);
  return sendSuccess(res, { message: 'Sellers fetched', data: { sellers } });
});

/** POST /api/product-requests — the buyer's city is attached so demand is counted per city */
const requestProduct = asyncHandler(async (req, res) => {
  const user = await User.findById(req.auth.userId).select('cityId').lean();
  const request = await createProductRequest(
    { userId: req.auth.userId, cityId: user?.cityId ? String(user.cityId) : undefined },
    req.body,
  );
  return sendSuccess(res, { statusCode: 201, message: 'Request sent', data: { request } });
});

module.exports = { listSellers, requestProduct };
