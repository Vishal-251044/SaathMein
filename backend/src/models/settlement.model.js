/**
 * Settlement model — Razorpay settlements (settlement.processed webhook) for the payout
 * screen and daily reconciliation (PRD §10.4). Amounts in paise.
 */
const { Schema, model } = require('mongoose');
const { paiseValidator } = require('./shared.schemas');

const settlementSchema = new Schema(
  {
    razorpaySettlementId: { type: String, required: true, trim: true },
    razorpayAccountId: { type: String, trim: true }, // linked account (dealer) or our own
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller' },
    amountPaise: { type: Number, required: true, validate: paiseValidator },
    feesPaise: { type: Number, default: 0, validate: paiseValidator },
    taxPaise: { type: Number, default: 0, validate: paiseValidator },
    utr: { type: String, trim: true }, // bank reference
    status: { type: String, trim: true },
    settledAt: Date,
  },
  { timestamps: true },
);

settlementSchema.index({ razorpaySettlementId: 1 }, { unique: true });
settlementSchema.index({ sellerId: 1, settledAt: -1 });

module.exports = model('Settlement', settlementSchema);
