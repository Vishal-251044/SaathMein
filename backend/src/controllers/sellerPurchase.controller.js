/**
 * Dealer purchases, payouts and commission invoices — /api/seller/purchases,
 * /api/seller/payouts, /api/seller/commission-invoices (PRD §10.10, PUR-2, F17).
 */
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const purchaseService = require('../services/purchases/purchase.service');
const payoutService = require('../services/purchases/payout.service');
const commissionService = require('../services/payments/commission.service');

/** @param {import('express').Request} req @returns {{ sellerId: string, userId: string }} */
const dealer = (req) => ({ sellerId: req.seller.sellerId, userId: req.auth.userId });

/** POST /api/seller/purchases/lookup { code } — see the buyer and price before confirming */
const lookup = asyncHandler(async (req, res) => {
  const purchase = await purchaseService.lookupPurchase(req.seller.sellerId, req.body.code);
  return sendSuccess(res, { message: 'Deal code found', data: { purchase } });
});

/** POST /api/seller/purchases/confirm { code } */
const confirm = asyncHandler(async (req, res) => {
  const purchase = await purchaseService.confirmPurchase(dealer(req), req.body.code);
  return sendSuccess(res, { message: 'Purchase confirmed', data: { purchase } });
});

/** GET /api/seller/purchases?status= */
const list = asyncHandler(async (req, res) => {
  const { purchases, meta } = await purchaseService.listSellerPurchases(
    req.seller.sellerId,
    req.validatedQuery,
  );
  return sendSuccess(res, { message: 'Purchases fetched', data: { purchases }, meta });
});

/** POST /api/seller/purchases/:purchaseId/object { reason } */
const object = asyncHandler(async (req, res) => {
  const purchase = await purchaseService.objectToInvoice(
    dealer(req),
    req.params.purchaseId,
    req.body.reason,
  );
  return sendSuccess(res, { message: 'Objection recorded', data: { purchase } });
});

/** GET /api/seller/purchases/:purchaseId/invoice-url — 10-minute private link */
const invoiceUrl = asyncHandler(async (req, res) => {
  const url = await purchaseService.sellerInvoiceUrl(req.seller.sellerId, req.params.purchaseId);
  return sendSuccess(res, { message: 'Invoice link ready', data: { url } });
});

/** GET /api/seller/payouts */
const payouts = asyncHandler(async (req, res) => {
  const { meta, ...data } = await payoutService.getPayouts(req.seller.sellerId, req.validatedQuery);
  return sendSuccess(res, { message: 'Payouts fetched', data, meta });
});

/** GET /api/seller/commission-invoices/:invoiceId */
const commissionInvoice = asyncHandler(async (req, res) => {
  const invoice = await commissionService.getInvoice(req.params.invoiceId, {
    sellerId: req.seller.sellerId,
  });
  return sendSuccess(res, { message: 'Invoice fetched', data: { invoice } });
});

module.exports = { lookup, confirm, list, object, invoiceUrl, payouts, commissionInvoice };
