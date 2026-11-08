/**
 * Payments controller — /api/payments (PRD §10.4, §12.3).
 */
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const paymentService = require('../services/payments/payment.service');
const { listMyPayments } = require('../services/payments/paymentQuery.service');
const { processWebhook } = require('../services/payments/webhook.service');

/** POST /api/payments/order — start a token checkout */
const createOrder = asyncHandler(async (req, res) => {
  const checkout = await paymentService.createTokenOrder(req.auth.userId, req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Checkout ready', data: { checkout } });
});

/** POST /api/payments/verify — after Razorpay Checkout succeeds in the app */
const verify = asyncHandler(async (req, res) => {
  const result = await paymentService.verifyCheckout(req.auth.userId, req.body);
  return sendSuccess(res, { message: 'Payment checked', data: result });
});

/** POST /api/payments/:paymentId/cancel — buyer closed Checkout: free the seat hold */
const cancel = asyncHandler(async (req, res) => {
  await paymentService.cancelCheckout(req.auth.userId, req.params.paymentId);
  return sendSuccess(res, { message: 'Checkout cancelled' });
});

/** GET /api/payments/me?groupId= — receipts and money timeline */
const myPayments = asyncHandler(async (req, res) => {
  const { payments, meta } = await listMyPayments(req.auth.userId, req.validatedQuery);
  return sendSuccess(res, { message: 'Payments fetched', data: { payments }, meta });
});

/**
 * POST /api/payments/webhook — Razorpay events (raw body, signature-checked).
 * 2xx tells Razorpay to stop; an error makes it retry.
 */
const webhook = asyncHandler(async (req, res) => {
  const result = await processWebhook({
    rawBody: req.body,
    signature: req.get('x-razorpay-signature'),
    eventId: req.get('x-razorpay-event-id'),
  });
  return sendSuccess(res, { message: 'Webhook received', data: result });
});

module.exports = { createOrder, verify, cancel, myPayments, webhook };
