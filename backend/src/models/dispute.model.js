/**
 * Dispute model — a buyer's complaint about the winning dealer (TRU-4, PRD §13
 * `disputes`): evidence (private photos / invoice, chat), the dealer's answer within 48 h,
 * and Support's decision (refund, credits, penalties). Every step is appended to
 * `timeline` and staff decisions are also in the audit log.
 */
const { Schema, model } = require('mongoose');
const { DISPUTE_OUTCOME, DISPUTE_STATUS, DISPUTE_TYPE, values } = require('../constants/enums');
const { paiseValidator } = require('./shared.schemas');

/** Private Cloudinary file (type: authenticated), opened only through signed URLs. */
const evidenceSchema = new Schema(
  {
    publicId: { type: String, required: true, trim: true },
    version: { type: Number, required: true },
    format: { type: String, trim: true },
    addedBy: { type: String, enum: ['buyer', 'seller'], required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const timelineSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    actorType: { type: String, enum: ['buyer', 'seller', 'staff', 'system'], required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true, trim: true },
    note: { type: String, trim: true, maxlength: 2000 },
  },
  { _id: false },
);

const disputeSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    purchaseId: { type: Schema.Types.ObjectId, ref: 'Purchase', required: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller', required: true },
    type: { type: String, enum: values(DISPUTE_TYPE), required: true },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    // Price the dealer asked at the shop (price not honoured), for Support
    quotedPricePaise: { type: Number, validate: paiseValidator },
    evidence: [evidenceSchema],
    // Chat messages the buyer points to (ids in the group chat)
    chatMessageIds: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
    status: { type: String, enum: values(DISPUTE_STATUS), default: DISPUTE_STATUS.AWAITING_SELLER },
    sellerDueAt: Date, // 48 h after opening
    sellerResponse: {
      text: { type: String, trim: true, maxlength: 2000 },
      by: { type: Schema.Types.ObjectId, ref: 'User' },
      at: Date,
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' }, // Support member
    decision: {
      outcome: { type: String, enum: values(DISPUTE_OUTCOME) },
      refundPaise: { type: Number, validate: paiseValidator },
      creditPaise: { type: Number, validate: paiseValidator },
      penalties: [{ type: String, enum: ['warning', 'rating_penalty', 'auction_suspension'] }],
      note: { type: String, trim: true, maxlength: 2000 },
      by: { type: Schema.Types.ObjectId, ref: 'User' },
      at: Date,
    },
    timeline: [timelineSchema],
  },
  { timestamps: true },
);

disputeSchema.index({ purchaseId: 1, status: 1 });
disputeSchema.index({ buyerId: 1, createdAt: -1 });
disputeSchema.index({ sellerId: 1, status: 1, createdAt: -1 });
disputeSchema.index({ status: 1, sellerDueAt: 1 }); // 48 h SLA sweep + queue by age

module.exports = model('Dispute', disputeSchema);
