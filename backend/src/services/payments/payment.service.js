/**
 * Token payments (PAY-1, PAY-2):
 * 1. createTokenOrder — the server creates the Razorpay order; the amount is the group's
 *    token snapshot, never a value from the app. A seat is held during checkout.
 * 2. verifyCheckout — checks Checkout's HMAC signature, then confirms the payment.
 * 3. confirmCapturedPayment — the ONE join path (used by verify, the webhook and
 *    reconciliation): payment paid + ledger token_held + member + memberCount in ONE
 *    MongoDB transaction, idempotent. If no seat is left, the token is refunded in full.
 */
const { Types } = require('mongoose');
const Group = require('../../models/group.model');
const GroupMember = require('../../models/groupMember.model');
const Payment = require('../../models/payment.model');
const User = require('../../models/user.model');
const Product = require('../../models/product.model');
const config = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { withTransaction } = require('../../utils/transaction');
const { assertWithinLimit } = require('../rateLimit.service');
const { getPaymentSettings } = require('../settings.service');
const { assertCanJoin } = require('../groups/membership.service');
const { transition } = require('../groups/stateMachine');
const { runGroupEffects } = require('../groups/groupEffects');
const { publishNewMember } = require('../groups/groupLive');
const { onDealMemberJoined } = require('../deals/deal.service');
const { issueDealCode } = require('../auction/dealCode.service');
const { holdGroupTransfersSafe } = require('../auction/settlement.service');
const razorpay = require('./razorpay.service');
const { recordLedger } = require('./ledger.service');
const { queueRefund, REFUND_REASON } = require('./refund.service');
const {
  GROUP_STATUS,
  LEDGER_TYPE,
  MEMBER_STATUS,
  PAYMENT_STATUS,
} = require('../../constants/enums');

const log = createLogger('PaymentService');
const MINUTE_MS = 60 * 1000;

/**
 * Seats currently held by other people's open checkouts.
 * @param {string} groupId - Group
 * @param {string} userId - Exclude this buyer
 * @param {Date} now - Current time
 * @returns {Promise<number>}
 */
const countReservedSeats = (groupId, userId, now) =>
  Payment.countDocuments({
    groupId,
    userId: { $ne: userId },
    status: PAYMENT_STATUS.CREATED,
    reservedUntil: { $gt: now },
  });

/**
 * Checkout data the app passes to Razorpay Standard Checkout.
 * @returns {Object}
 */
const toCheckout = (payment, { productName, user }) => ({
  paymentId: String(payment._id),
  orderId: payment.razorpayOrderId,
  amountPaise: payment.amountPaise,
  currency: payment.currency,
  keyId: config.razorpay.keyId, // public key id (never the secret)
  reservedUntil: payment.reservedUntil,
  name: 'SaathMein',
  description: productName,
  prefill: { name: user?.name || undefined, contact: user?.phone || undefined },
});

/**
 * Start a token checkout (POST /payments/order).
 * @param {string} userId - Buyer
 * @param {{ groupId: string, code?: string }} input
 * @returns {Promise<Object>} Checkout data
 * @throws {ApiError} 404, 409 join rules, 429, 503 payments unavailable
 */
const createTokenOrder = async (userId, { groupId, code }) => {
  await assertWithinLimit({
    key: `payment-order:${userId}`,
    limit: 10,
    windowMs: 10 * MINUTE_MS,
    message: 'Too many payment attempts. Please wait a few minutes.',
  });

  const now = new Date();
  const group = await Group.findById(groupId).lean();
  if (!group) throw ApiError.notFound('Group not found');
  const [membership, user, product, settings] = await Promise.all([
    GroupMember.findOne({ groupId, userId }).lean(),
    User.findById(userId).select('name phone').lean(),
    Product.findById(group.productId).select('brand model').lean(),
    getPaymentSettings(),
  ]);
  const productName = product ? `${product.brand} ${product.model}` : 'Group token';

  // Same buyer tapping Join again: reuse the open checkout (one order per seat)
  const open = await Payment.findOne({
    groupId,
    userId,
    status: PAYMENT_STATUS.CREATED,
    reservedUntil: { $gt: now },
  }).lean();
  if (open) return toCheckout(open, { productName, user });

  assertCanJoin(group, userId, membership, {
    code,
    reservedSeats: await countReservedSeats(groupId, userId, now),
    now,
  });

  const paymentId = new Types.ObjectId();
  const order = await razorpay.createOrder({
    amountPaise: group.tokenAmountPaise, // server-side amount only (PAY-1)
    receipt: String(paymentId),
    notes: { paymentId: String(paymentId), groupId: String(groupId), userId: String(userId) },
  });
  if (order.amount !== group.tokenAmountPaise) {
    throw new ApiError(502, 'Payment provider returned a wrong amount', { code: 'RAZORPAY_ERROR' });
  }

  const payment = await Payment.create({
    _id: paymentId,
    userId,
    groupId,
    razorpayOrderId: order.id,
    amountPaise: group.tokenAmountPaise,
    currency: 'INR',
    status: PAYMENT_STATUS.CREATED,
    reservedUntil: new Date(now.getTime() + settings.seatReservationMinutes * MINUTE_MS),
  });
  log.info(
    { paymentId: String(paymentId), groupId, userId, orderId: order.id },
    'Token order created',
  );
  return toCheckout(payment, { productName, user });
};

/**
 * Check a captured Razorpay payment really is this order's token.
 * @param {Object} payment - Our payment
 * @param {Object} entity - Razorpay payment entity
 * @returns {string|null} Problem, or null when it matches
 */
const mismatchReason = (payment, entity) => {
  if (entity.order_id !== payment.razorpayOrderId) return 'order id does not match';
  if (entity.currency !== 'INR') return `currency ${entity.currency}`;
  if (entity.amount !== payment.amountPaise)
    return `amount ${entity.amount} ≠ ${payment.amountPaise}`;
  return null;
};

/**
 * The one join path (idempotent). Records a captured payment and gives the seat.
 * @param {Object|string} paymentOrId - Our payment (or id)
 * @param {Object} entity - Razorpay payment entity (status "captured")
 * @param {{ source: 'verify'|'webhook'|'reconciliation' }} [options]
 * @returns {Promise<{ outcome: 'joined'|'already_processed'|'seat_unavailable'|'mismatch', groupId: string }>}
 */
const confirmCapturedPayment = async (paymentOrId, entity, { source = 'webhook' } = {}) => {
  const payment =
    typeof paymentOrId === 'object' ? paymentOrId : await Payment.findById(paymentOrId).lean();
  if (!payment) throw ApiError.notFound('Payment not found');
  const groupId = String(payment.groupId);

  const problem = mismatchReason(payment, entity);
  if (problem) {
    log.error(
      { paymentId: String(payment._id), razorpayPaymentId: entity.id, problem, source },
      '[PaymentService] captured payment does not match the order',
    );
  }

  const now = new Date();
  const result = await withTransaction(async (session) => {
    // 1. Mark paid exactly once (created/failed → paid)
    const paid = await Payment.findOneAndUpdate(
      { _id: payment._id, status: { $in: [PAYMENT_STATUS.CREATED, PAYMENT_STATUS.FAILED] } },
      {
        $set: {
          status: PAYMENT_STATUS.PAID,
          razorpayPaymentId: entity.id,
          method: entity.method,
          razorpayFeePaise: entity.fee ?? undefined,
          razorpayTaxPaise: entity.tax ?? undefined,
          paidAt: entity.created_at ? new Date(entity.created_at * 1000) : now,
          failureReason: problem || undefined,
        },
        $unset: { reservedUntil: 1 },
      },
      { new: true, session },
    );
    if (!paid) return { outcome: 'already_processed' };

    // 2. Money is in: ledger first (the actual captured amount)
    await recordLedger(
      [
        {
          type: LEDGER_TYPE.TOKEN_HELD,
          amountPaise: entity.amount,
          userId: paid.userId,
          groupId: paid.groupId,
          paymentId: paid._id,
          ref: entity.id,
          note: source,
        },
      ],
      session,
    );
    if (problem) return { outcome: 'mismatch' };

    // 3. Take a seat: open group, or a full group with a live waitlist offer for this buyer
    const membership = await GroupMember.findOne({ groupId, userId: paid.userId }).session(session);
    const hasOffer =
      membership?.status === MEMBER_STATUS.WAITLISTED && membership.offerExpiresAt > now;
    const seatGroup = await Group.findOneAndUpdate(
      {
        _id: groupId,
        // A waitlist seat offer also works in a won group during its exit window
        status: hasOffer
          ? {
              $in: [
                GROUP_STATUS.OPEN,
                GROUP_STATUS.FULL,
                GROUP_STATUS.WON,
                GROUP_STATUS.PURCHASING,
              ],
            }
          : GROUP_STATUS.OPEN,
        $expr: { $lt: ['$memberCount', '$targetSize'] },
      },
      { $inc: { memberCount: 1 } },
      { new: true, session },
    );
    if (!seatGroup) {
      await Payment.updateOne({ _id: paid._id }, { $set: { seatUnavailable: true } }, { session });
      return { outcome: 'seat_unavailable' };
    }

    await GroupMember.updateOne(
      { groupId, userId: paid.userId },
      {
        $set: { status: MEMBER_STATUS.ACTIVE, paymentId: paid._id, joinedAt: now },
        $unset: { leftAt: 1, offerExpiresAt: 1, waitlistPosition: 1 },
      },
      { upsert: true, session },
    );

    // 4. Last seat taken → seats lock (state machine, effects after commit)
    if (seatGroup.status === GROUP_STATUS.OPEN && seatGroup.memberCount >= seatGroup.targetSize) {
      const full = await transition(seatGroup, GROUP_STATUS.FULL, {
        reason: 'target_reached',
        session,
      });
      return { outcome: 'joined', full, seatGroup };
    }
    return { outcome: 'joined', seatGroup };
  });

  // Live counter + new-member animation for everyone watching (LIV-1)
  if (result.outcome === 'joined') {
    await publishNewMember(groupId, payment.userId);
    // Seller-led deal: a tier may have just unlocked (AUC-9)
    await onDealMemberJoined(result.seatGroup);
    // Seat taken after a win (waitlist offer): this member needs a deal code too
    if ([GROUP_STATUS.WON, GROUP_STATUS.PURCHASING].includes(result.seatGroup.status)) {
      const member = await GroupMember.findOne({ groupId, userId: payment.userId })
        .select('_id dealCode')
        .lean();
      if (member) await issueDealCode(member);
      // The new member's token joins the dealer's held transfers (PAY-4)
      await holdGroupTransfersSafe(groupId);
    }
  }
  if (result.full) await runGroupEffects(result.full, GROUP_STATUS.OPEN);
  if (result.outcome === 'seat_unavailable' || result.outcome === 'mismatch') {
    await queueRefund(payment._id, {
      reason:
        result.outcome === 'mismatch'
          ? REFUND_REASON.AMOUNT_MISMATCH
          : REFUND_REASON.SEAT_UNAVAILABLE,
    });
  }
  log.info(
    { paymentId: String(payment._id), groupId, outcome: result.outcome, source },
    'Captured payment confirmed',
  );
  return { outcome: result.outcome, groupId };
};

/**
 * After Checkout: verify the signature, capture if needed, then confirm.
 * @param {string} userId - Buyer
 * @param {{ orderId: string, razorpayPaymentId: string, signature: string }} input
 * @returns {Promise<{ outcome: string, groupId: string }>}
 * @throws {ApiError} 400 INVALID_SIGNATURE, 404
 */
const verifyCheckout = async (userId, { orderId, razorpayPaymentId, signature }) => {
  const payment = await Payment.findOne({ razorpayOrderId: orderId, userId }).lean();
  if (!payment) throw ApiError.notFound('Payment not found');
  if (!razorpay.verifyPaymentSignature({ orderId, paymentId: razorpayPaymentId, signature })) {
    log.warn(
      { paymentId: String(payment._id), userId },
      '[PaymentService] checkout signature mismatch',
    );
    throw ApiError.badRequest(
      'We could not verify this payment. If money was taken, it will be refunded.',
      {
        code: 'INVALID_SIGNATURE',
      },
    );
  }
  if (payment.status !== PAYMENT_STATUS.CREATED && payment.status !== PAYMENT_STATUS.FAILED) {
    return { outcome: 'already_processed', groupId: String(payment.groupId) };
  }

  let entity = await razorpay.fetchPayment(razorpayPaymentId);
  if (entity.order_id !== orderId) {
    throw ApiError.badRequest('This payment does not belong to the order', {
      code: 'INVALID_SIGNATURE',
    });
  }
  if (entity.status === 'authorized')
    entity = await razorpay.capturePayment(razorpayPaymentId, payment.amountPaise);
  if (entity.status !== 'captured') {
    // Webhook will finish it (e.g. UPI still pending)
    return { outcome: 'processing', groupId: String(payment.groupId) };
  }
  return confirmCapturedPayment(payment, entity, { source: 'verify' });
};

/**
 * payment.failed: free the seat hold so others can join; no member is added.
 * @param {Object} entity - Razorpay payment entity
 * @returns {Promise<boolean>}
 */
const handlePaymentFailed = async (entity) => {
  const result = await Payment.updateOne(
    { razorpayOrderId: entity.order_id, status: PAYMENT_STATUS.CREATED },
    {
      $set: {
        status: PAYMENT_STATUS.FAILED,
        failureReason: entity.error_description || entity.error_reason || 'failed',
      },
      $unset: { reservedUntil: 1 },
    },
  );
  return result.modifiedCount > 0;
};

/** Release my own seat hold (user closed Checkout without paying). */
const cancelCheckout = async (userId, paymentId) => {
  await Payment.updateOne(
    { _id: paymentId, userId, status: PAYMENT_STATUS.CREATED },
    { $unset: { reservedUntil: 1 } },
  );
};

module.exports = {
  countReservedSeats,
  createTokenOrder,
  mismatchReason,
  confirmCapturedPayment,
  verifyCheckout,
  handlePaymentFailed,
  cancelCheckout,
};
