/**
 * Razorpay wrapper (PRD §10.4): signature checks and every SDK call SaathMein makes, with
 * clear errors and logs. Amounts are integer paise (Razorpay also works in paise).
 * - Checkout signature: HMAC-SHA256(order_id|payment_id) with the KEY SECRET (PAY-1).
 * - Webhook signature: HMAC-SHA256(raw body) with the WEBHOOK SECRET — a different secret.
 */
const config = require('../../config/env');
const { getRazorpay } = require('../../config/razorpay');
const ApiError = require('../../utils/ApiError');
const { hmacSha256, safeEqual } = require('../../utils/crypto');
const { createLogger } = require('../../utils/logger');

const log = createLogger('RazorpayService');

/**
 * Check the signature Checkout returns after a payment.
 * @param {{ orderId: string, paymentId: string, signature: string }} checkout
 * @returns {boolean}
 */
const verifyPaymentSignature = ({ orderId, paymentId, signature }) => {
  if (!config.razorpay.keySecret || !signature) return false;
  const expected = hmacSha256(`${orderId}|${paymentId}`, config.razorpay.keySecret);
  return safeEqual(signature, expected);
};

/**
 * Check a webhook's x-razorpay-signature against the RAW request body.
 * @param {Buffer|string} rawBody - Exact bytes Razorpay sent
 * @param {string} signature - Header value
 * @returns {boolean}
 */
const verifyWebhookSignature = (rawBody, signature) => {
  if (!config.razorpay.webhookSecret || !signature || rawBody == null) return false;
  const expected = hmacSha256(rawBody, config.razorpay.webhookSecret);
  return safeEqual(signature, expected);
};

/**
 * The configured client, or a clear 503.
 * @returns {Object} Razorpay SDK client
 * @throws {ApiError} 503 PAYMENTS_UNAVAILABLE
 */
const client = () => {
  const razorpay = getRazorpay();
  if (!razorpay) {
    throw new ApiError(503, 'Payments are not available right now. Please try again later.', {
      code: 'PAYMENTS_UNAVAILABLE',
    });
  }
  return razorpay;
};

/**
 * Run one SDK call; log and convert failures to a 502 with Razorpay's description.
 * @param {string} action - What we were doing (for logs)
 * @param {Object} context - Ids for logs (never card/UPI details)
 * @param {(razorpay: Object) => Promise<*>} call - SDK call
 * @returns {Promise<*>}
 * @throws {ApiError} 502 RAZORPAY_ERROR
 */
const run = async (action, context, call) => {
  const razorpay = client();
  try {
    return await call(razorpay);
  } catch (err) {
    const description = err?.error?.description || err?.message || 'Razorpay request failed';
    log.error(
      { ...context, err: description, status: err?.statusCode },
      `[RazorpayService] ${action} failed`,
    );
    throw new ApiError(502, `Payment provider error: ${description}`.slice(0, 300), {
      code: 'RAZORPAY_ERROR',
      details: { action, statusCode: err?.statusCode },
    });
  }
};

/** @param {{ amountPaise: number, receipt: string, notes: Object }} order */
const createOrder = ({ amountPaise, receipt, notes }) =>
  run('createOrder', { receipt }, (rp) =>
    rp.orders.create({ amount: amountPaise, currency: 'INR', receipt, notes }),
  );

/** @param {string} paymentId - pay_... */
const fetchPayment = (paymentId) =>
  run('fetchPayment', { paymentId }, (rp) => rp.payments.fetch(paymentId));

/** Capture an authorized payment (when auto-capture is off). */
const capturePayment = (paymentId, amountPaise) =>
  run('capturePayment', { paymentId }, (rp) => rp.payments.capture(paymentId, amountPaise, 'INR'));

/** @param {string} paymentId @param {{ amountPaise: number, notes: Object, receipt: string }} refund */
const createRefund = (paymentId, { amountPaise, notes, receipt }) =>
  run('createRefund', { paymentId, receipt }, (rp) =>
    rp.payments.refund(paymentId, { amount: amountPaise, speed: 'normal', notes, receipt }),
  );

/** Route transfer from a captured payment to a linked account, on hold (PAY-4). */
const createTransfer = (paymentId, { accountId, amountPaise, notes, onHold = true }) =>
  run('createTransfer', { paymentId, accountId }, (rp) =>
    rp.payments.transfer(paymentId, {
      transfers: [
        {
          account: accountId,
          amount: amountPaise,
          currency: 'INR',
          on_hold: onHold ? 1 : 0,
          notes,
        },
      ],
    }),
  );

/** Release (on_hold: 0) a held transfer. */
const releaseTransferHold = (transferId) =>
  run('releaseTransferHold', { transferId }, (rp) => rp.transfers.edit(transferId, { on_hold: 0 }));

/** Take a transfer back from the linked account. */
const reverseTransfer = (transferId, amountPaise) =>
  run('reverseTransfer', { transferId }, (rp) =>
    rp.transfers.reverse(transferId, { amount: amountPaise }),
  );

/**
 * One page of payments or refunds in a time window (reconciliation).
 * @param {'payments'|'refunds'} kind
 * @param {{ from: number, to: number, skip: number, count: number }} window - Unix seconds
 */
const listEntities = (kind, window) =>
  run(`list ${kind}`, { from: window.from, skip: window.skip }, (rp) => rp[kind].all(window));

module.exports = {
  verifyPaymentSignature,
  verifyWebhookSignature,
  createOrder,
  fetchPayment,
  capturePayment,
  createRefund,
  createTransfer,
  releaseTransferHold,
  reverseTransfer,
  listEntities,
};
