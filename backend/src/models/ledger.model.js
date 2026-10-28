/**
 * Ledger model — append-only record of EVERY money movement (PAY-5).
 * Entries are never updated or deleted; a mistake is corrected with a new entry.
 * Daily reconciliation compares this ledger with Razorpay (PAY-7).
 */
const { Schema, model } = require('mongoose');
const { LEDGER_TYPE, values } = require('../constants/enums');
const { paiseValidator } = require('./shared.schemas');
const appendOnlyPlugin = require('./plugins/appendOnly.plugin');

const ledgerSchema = new Schema(
  {
    type: { type: String, enum: values(LEDGER_TYPE), required: true },
    amountPaise: { type: Number, required: true, validate: paiseValidator },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller' },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group' },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    // External reference: Razorpay payment / refund / transfer id, invoice no., etc.
    ref: { type: String, trim: true },
    note: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }, // null = system
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

ledgerSchema.plugin(appendOnlyPlugin);

ledgerSchema.index({ groupId: 1, createdAt: 1 });
ledgerSchema.index({ paymentId: 1, createdAt: 1 });
ledgerSchema.index({ sellerId: 1, createdAt: -1 });
ledgerSchema.index({ type: 1, createdAt: -1 });

module.exports = model('Ledger', ledgerSchema);
