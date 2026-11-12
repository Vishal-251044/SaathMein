/**
 * SellerDue model — money a dealer owes SaathMein outside commission, e.g. wallet credits
 * SaathMein gave a buyer after a dispute when the token was already released to the
 * dealer (decided 12 Nov 2026). Billed (without GST) on the dealer's next monthly
 * commission invoice. Append-only: amounts never change; `invoiceId` is set when billed.
 */
const { Schema, model } = require('mongoose');
const { paiseValidator } = require('./shared.schemas');

const sellerDueSchema = new Schema(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller', required: true, immutable: true },
    amountPaise: { type: Number, required: true, immutable: true, validate: paiseValidator },
    reason: { type: String, required: true, trim: true, immutable: true },
    disputeId: { type: Schema.Types.ObjectId, ref: 'Dispute', immutable: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', immutable: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', immutable: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'CommissionInvoice' },
  },
  { timestamps: true },
);

sellerDueSchema.index(
  { disputeId: 1 },
  { unique: true, partialFilterExpression: { disputeId: { $type: 'objectId' } } },
);
sellerDueSchema.index({ sellerId: 1, invoiceId: 1, createdAt: 1 });

module.exports = model('SellerDue', sellerDueSchema);
