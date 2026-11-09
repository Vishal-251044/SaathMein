/**
 * Buyer purchases and reviews — /api/purchases, /api/reviews, /api/users/me/deal-codes
 * (PRD §10.6, §12.3).
 */
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const purchaseService = require('../services/purchases/purchase.service');
const reviewService = require('../services/purchases/review.service');

/** GET /api/users/me/deal-codes */
const myDealCodes = asyncHandler(async (req, res) => {
  const purchases = await purchaseService.listMyDealCodes(req.auth.userId);
  return sendSuccess(res, { message: 'Deal codes fetched', data: { purchases } });
});

/** POST /api/purchases/:purchaseId/invoice/upload-params */
const invoiceUploadParams = asyncHandler(async (req, res) => {
  const upload = await purchaseService.getInvoiceUploadParams(
    req.auth.userId,
    req.params.purchaseId,
  );
  return sendSuccess(res, { message: 'Upload ready', data: upload });
});

/** POST /api/purchases/:purchaseId/invoice */
const submitInvoice = asyncHandler(async (req, res) => {
  const purchase = await purchaseService.submitInvoice(
    req.auth.userId,
    req.params.purchaseId,
    req.body,
  );
  return sendSuccess(res, { message: 'Invoice added', data: { purchase } });
});

/** POST /api/reviews */
const createReview = asyncHandler(async (req, res) => {
  const review = await reviewService.createReview(req.auth.userId, req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Thanks for your review', data: { review } });
});

module.exports = { myDealCodes, invoiceUploadParams, submitInvoice, createReview };
