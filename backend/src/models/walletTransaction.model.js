/**
 * WalletTransaction model — every change to a user's SaathMein credits (REF-1 to REF-3).
 * Append-only: credits are never edited or deleted, corrections are new rows. `key` makes
 * each reward idempotent (e.g. "referral-friend:<userId>"). Credits are not cash and can
 * never be withdrawn; spending on tokens arrives later (decided 12 Nov 2026).
 */
const { Schema, model } = require('mongoose');
const { WALLET_TXN_TYPE, values } = require('../constants/enums');
const appendOnlyPlugin = require('./plugins/appendOnly.plugin');

const walletTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    type: { type: String, enum: values(WALLET_TXN_TYPE), required: true, immutable: true },
    // Positive = credit, negative = debit (integer paise)
    amountPaise: {
      type: Number,
      required: true,
      immutable: true,
      validate: { validator: Number.isSafeInteger, message: 'amountPaise must be integer paise' },
    },
    balanceAfterPaise: { type: Number, required: true, immutable: true, min: 0 },
    key: { type: String, required: true, immutable: true, trim: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', immutable: true },
    purchaseId: { type: Schema.Types.ObjectId, ref: 'Purchase', immutable: true },
    relatedUserId: { type: Schema.Types.ObjectId, ref: 'User', immutable: true }, // the friend / referrer
    note: { type: String, trim: true, maxlength: 300, immutable: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

walletTransactionSchema.index({ key: 1 }, { unique: true });
walletTransactionSchema.index({ userId: 1, createdAt: -1 });

walletTransactionSchema.plugin(appendOnlyPlugin);

module.exports = model('WalletTransaction', walletTransactionSchema);
