/**
 * Purchase model — one member buying from the winning dealer (PRD §13 `purchases`,
 * PUR-1 to PUR-4). Created with the deal code when a group is won; completed when the
 * dealer confirms the code, or the buyer's invoice stands 48 h without an objection.
 * Expires (refund minus back-out fee) when the dealer's price validity ends unused.
 */
const { Schema, model } = require('mongoose');
const { PURCHASE_STATUS, values } = require('../constants/enums');
const { paiseValidator } = require('./shared.schemas');

const invoiceSchema = new Schema(
  {
    // Private Cloudinary upload (type: authenticated) — opened only with signed URLs
    publicId: { type: String, required: true, trim: true },
    version: { type: Number, required: true },
    format: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now },
    // Day 19: AI invoice check (OCR) result
    ocr: { type: Schema.Types.Mixed },
    matchScore: { type: Number, min: 0, max: 1 },
  },
  { _id: false },
);

const purchaseSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    memberId: { type: Schema.Types.ObjectId, ref: 'GroupMember', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller', required: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    bidId: { type: Schema.Types.ObjectId, ref: 'Bid' },
    dealCode: { type: String, required: true, trim: true, uppercase: true },
    pricePaise: { type: Number, required: true, validate: paiseValidator }, // winning price per unit
    tokenPaise: { type: Number, default: 0, validate: paiseValidator }, // part-payment already made
    status: { type: String, enum: values(PURCHASE_STATUS), default: PURCHASE_STATUS.PENDING },
    validUntil: { type: Date, required: true },
    reminderSentAt: Date,
    invoice: invoiceSchema,
    // Invoice path: completes at this time unless the dealer objects (PUR-3)
    autoCompleteAt: Date,
    objection: {
      reason: { type: String, trim: true, maxlength: 500 },
      by: { type: Schema.Types.ObjectId, ref: 'User' },
      at: Date,
    },
    completedAt: Date,
    completedVia: { type: String, enum: ['seller', 'invoice'] },
    confirmedBy: { type: Schema.Types.ObjectId, ref: 'User' }, // dealer team member
    holdReleasedAt: Date, // Route hold released to the dealer (PAY-4)
    refundQueuedAt: Date, // expired: hold reversed and refund queued
    reviewedAt: Date,
  },
  { timestamps: true },
);

purchaseSchema.index({ memberId: 1 }, { unique: true });
purchaseSchema.index({ dealCode: 1 }, { unique: true });
purchaseSchema.index({ sellerId: 1, status: 1, updatedAt: -1 });
purchaseSchema.index({ userId: 1, status: 1 });
purchaseSchema.index({ groupId: 1, status: 1 });
purchaseSchema.index({ status: 1, validUntil: 1 }); // expiry + reminder sweep
purchaseSchema.index({ status: 1, autoCompleteAt: 1 }); // invoice auto-complete sweep

module.exports = model('Purchase', purchaseSchema);
