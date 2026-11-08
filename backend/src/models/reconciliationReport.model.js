/**
 * ReconciliationReport model — result of the nightly comparison between our payments /
 * ledger and Razorpay (PAY-7). Mismatches show on the admin Payment monitor (Day 13).
 */
const { Schema, model } = require('mongoose');

const mismatchSchema = new Schema(
  {
    kind: { type: String, required: true }, // missing_payment, amount_mismatch, missing_refund, ...
    razorpayId: { type: String, trim: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    expectedPaise: Number,
    actualPaise: Number,
    detail: { type: String, trim: true },
    autoFixed: { type: Boolean, default: false },
  },
  { _id: false },
);

const reconciliationReportSchema = new Schema(
  {
    day: { type: String, required: true }, // YYYY-MM-DD (IST) that was checked
    status: { type: String, enum: ['ok', 'mismatch', 'failed'], required: true },
    counts: {
      razorpayPayments: Number,
      razorpayRefunds: Number,
      ourPayments: Number,
      ourRefunds: Number,
    },
    totals: {
      capturedPaise: Number,
      ledgerHeldPaise: Number,
      refundedPaise: Number,
      ledgerRefundedPaise: Number,
    },
    mismatches: [mismatchSchema],
    error: { type: String, trim: true },
  },
  { timestamps: true },
);

reconciliationReportSchema.index({ day: 1, createdAt: -1 });

module.exports = model('ReconciliationReport', reconciliationReportSchema);
