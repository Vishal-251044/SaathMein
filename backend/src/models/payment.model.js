/**
 * Payment model — one buyer token paid through Razorpay for one group, plus its refunds
 * and its Route transfer to the winning dealer. PRD §13 `payments`, §10.4.
 * All amounts are integer paise. Webhooks are the source of truth for status.
 */
const { Schema, model } = require('mongoose');
const { PAYMENT_STATUS, values } = require('../constants/enums');
const { paiseValidator } = require('./shared.schemas');

const refundSchema = new Schema(
  {
    razorpayRefundId: { type: String, trim: true },
    amountPaise: { type: Number, required: true, validate: paiseValidator },
    reason: { type: String, required: true, trim: true }, // left_open_group, expired, no_deal, ...
    status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' },
    initiatedBy: { type: Schema.Types.ObjectId, ref: 'User' }, // null = system
    createdAt: { type: Date, default: Date.now },
    processedAt: Date,
  },
  { _id: true },
);

const transferSchema = new Schema(
  {
    razorpayTransferId: { type: String, trim: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller' },
    amountPaise: { type: Number, validate: paiseValidator }, // token minus commission
    commissionPaise: { type: Number, validate: paiseValidator },
    onHold: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['pending', 'processed', 'released', 'reversed', 'failed'],
      default: 'pending',
    },
    releasedAt: Date,
    reversedAt: Date,
  },
  { _id: false },
);

const paymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    razorpayOrderId: { type: String, required: true, trim: true },
    razorpayPaymentId: { type: String, trim: true },
    amountPaise: { type: Number, required: true, validate: paiseValidator },
    currency: { type: String, default: 'INR' },
    method: { type: String, trim: true }, // upi, card, netbanking, wallet
    razorpayFeePaise: { type: Number, validate: paiseValidator },
    razorpayTaxPaise: { type: Number, validate: paiseValidator },
    status: { type: String, enum: values(PAYMENT_STATUS), default: PAYMENT_STATUS.CREATED },
    failureReason: { type: String, trim: true },
    refunds: [refundSchema],
    transfer: { type: transferSchema, default: undefined },
    // Razorpay webhook event ids already processed (idempotency, PAY-2)
    webhookEvents: [{ type: String }],
    paidAt: Date,
  },
  { timestamps: true },
);

paymentSchema.index({ razorpayOrderId: 1 }, { unique: true });
paymentSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: 'string' } } },
);
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ groupId: 1, status: 1 });

module.exports = model('Payment', paymentSchema);
