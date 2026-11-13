/**
 * Razorpay webhooks — the source of truth for payment, refund and transfer status (PAY-2).
 * 1. The signature is checked against the RAW body with the webhook secret.
 * 2. The event id is claimed in `webhookEvents` (unique); a processed event is never
 *    processed again; a failed one is retried when Razorpay redelivers it.
 * 3. Each handler is itself idempotent (status-guarded updates), so even a lost claim
 *    cannot double-count money.
 */
const crypto = require('crypto');
const Payment = require('../../models/payment.model');
const WebhookEvent = require('../../models/webhookEvent.model');
const Settlement = require('../../models/settlement.model');
const Seller = require('../../models/seller.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const razorpay = require('./razorpay.service');
const { confirmCapturedPayment, handlePaymentFailed } = require('./payment.service');
const { markRefundProcessed, markRefundFailed } = require('./refund.service');
const { handleTransferEvent } = require('./route.service');

const log = createLogger('WebhookService');

/**
 * Claim an event id. Returns false when it was already processed (or is being processed).
 * @param {string} eventId - x-razorpay-event-id
 * @param {string} event - Event name
 * @returns {Promise<boolean>}
 */
const claimEvent = async (eventId, event) => {
  try {
    await WebhookEvent.create({ eventId, event, status: 'processing' });
    return true;
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }
  // Seen before: only a failed attempt may run again
  const retry = await WebhookEvent.updateOne(
    { eventId, status: 'failed' },
    { $set: { status: 'processing', error: null }, $inc: { attempts: 1 } },
  );
  return retry.modifiedCount > 0;
};

/** Event handlers. Each returns 'processed' or 'ignored'. */
const HANDLERS = {
  'payment.captured': async (payload) => {
    const entity = payload.payment.entity;
    const payment = await Payment.findOne({ razorpayOrderId: entity.order_id }).lean();
    if (!payment) return 'ignored'; // not a SaathMein token order
    await confirmCapturedPayment(payment, entity, { source: 'webhook' });
    return 'processed';
  },
  'payment.authorized': async (payload) => {
    // Only when auto-capture is off: capture now; payment.captured follows
    const entity = payload.payment.entity;
    const payment = await Payment.findOne({ razorpayOrderId: entity.order_id }).lean();
    if (!payment) return 'ignored';
    await razorpay.capturePayment(entity.id, payment.amountPaise);
    return 'processed';
  },
  'payment.failed': async (payload) =>
    (await handlePaymentFailed(payload.payment.entity)) ? 'processed' : 'ignored',
  'refund.processed': async (payload) => {
    const entity = payload.refund.entity;
    const done = await markRefundProcessed(
      entity.id,
      new Date((entity.created_at || Date.now() / 1000) * 1000),
    );
    return done ? 'processed' : 'ignored';
  },
  'refund.failed': async (payload) =>
    (await markRefundFailed(payload.refund.entity.id, payload.refund.entity.error?.description))
      ? 'processed'
      : 'ignored',
  'transfer.processed': async (payload) =>
    (await handleTransferEvent(payload.transfer.entity, false)) ? 'processed' : 'ignored',
  'transfer.failed': async (payload) =>
    (await handleTransferEvent(payload.transfer.entity, true)) ? 'processed' : 'ignored',
  'settlement.processed': async (payload) => {
    const entity = payload.settlement.entity;
    const seller = payload.account_id
      ? await Seller.findOne({ razorpayAccountId: payload.account_id }).select('_id').lean()
      : null;
    await Settlement.updateOne(
      { razorpaySettlementId: entity.id },
      {
        $setOnInsert: {
          razorpayAccountId: payload.account_id,
          sellerId: seller?._id,
          amountPaise: entity.amount,
          feesPaise: entity.fees ?? 0,
          taxPaise: entity.tax ?? 0,
          utr: entity.utr,
          status: entity.status,
          settledAt: entity.created_at ? new Date(entity.created_at * 1000) : new Date(),
        },
      },
      { upsert: true },
    );
    return 'processed';
  },
};

/** Entity id for the event log. */
const entityIdOf = (body) => {
  const payload = body.payload || {};
  const first = Object.values(payload).find((item) => item?.entity?.id);
  return first?.entity?.id;
};

/**
 * Handle one webhook delivery.
 * @param {{ rawBody: Buffer, signature: string, eventId?: string }} delivery
 * @returns {Promise<{ status: 'processed'|'ignored'|'duplicate' }>}
 * @throws {ApiError} 400 INVALID_SIGNATURE / INVALID_PAYLOAD; handler errors (→ 500, Razorpay retries)
 */
const processWebhook = async ({ rawBody, signature, eventId }) => {
  if (!razorpay.verifyWebhookSignature(rawBody, signature)) {
    log.warn({ eventId }, '[WebhookService] invalid webhook signature');
    await require('../alerts/alert.service').raiseAlert({
      type: 'payment',
      severity: 'warning',
      title: 'Webhook with an invalid signature',
      message:
        'A request to the Razorpay webhook had a wrong signature. Check the webhook secret, or someone is probing the endpoint.',
      subjectType: 'payment',
      dedupeKey: 'webhook:invalid-signature',
    });
    throw ApiError.badRequest('Invalid webhook signature', { code: 'INVALID_SIGNATURE' });
  }
  let body;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw ApiError.badRequest('Invalid webhook payload', { code: 'INVALID_PAYLOAD' });
  }

  // Razorpay always sends x-razorpay-event-id; fall back to a hash of the body
  const id = eventId || crypto.createHash('sha256').update(rawBody).digest('hex');
  const handler = HANDLERS[body.event];
  if (!(await claimEvent(id, body.event))) return { status: 'duplicate' };

  try {
    const status = handler ? await handler(body.payload || {}) : 'ignored';
    await WebhookEvent.updateOne(
      { eventId: id },
      { $set: { status, entityId: entityIdOf(body), processedAt: new Date() } },
    );
    return { status };
  } catch (err) {
    await WebhookEvent.updateOne(
      { eventId: id },
      { $set: { status: 'failed', error: err.message } },
    );
    log.error(
      { eventId: id, event: body.event, err: err.message },
      '[WebhookService] handler failed',
    );
    await require('../alerts/alert.service').raiseAlert({
      type: 'payment',
      severity: 'critical',
      title: `Webhook failed: ${body.event}`,
      message: `${err.message}. Razorpay will retry; check the Payment monitor.`,
      subjectType: 'payment',
      dedupeKey: `webhook:failed:${body.event}`,
    });
    throw err;
  }
};

module.exports = { HANDLERS, claimEvent, processWebhook };
