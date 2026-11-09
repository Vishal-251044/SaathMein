/**
 * CommissionInvoice model — the monthly GST invoice SaathMein issues to each dealer for
 * commission (F17, PRD §11 money step 4). Numbered per financial year
 * (e.g. SM/2026-27/0001). Lines and totals are frozen when issued; only `status` and
 * `paidAt` change later.
 */
const { Schema, model } = require('mongoose');
const { COMMISSION_INVOICE_STATUS, values } = require('../constants/enums');
const { paiseValidator } = require('./shared.schemas');

const paise = { type: Number, required: true, validate: paiseValidator };

const lineSchema = new Schema(
  {
    commissionId: { type: Schema.Types.ObjectId, ref: 'Commission', required: true },
    purchaseId: { type: Schema.Types.ObjectId, ref: 'Purchase' },
    productName: String,
    completedAt: Date,
    pricePaise: paise,
    commissionPaise: paise,
    fromTokenPaise: paise,
  },
  { _id: false },
);

const commissionInvoiceSchema = new Schema(
  {
    invoiceNo: { type: String, required: true, trim: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller', required: true },
    period: {
      key: { type: String, required: true }, // "2026-10"
      from: { type: Date, required: true },
      to: { type: Date, required: true },
    },
    issuedAt: { type: Date, default: Date.now },
    // Snapshots: what the invoice says even if details change later
    supplier: {
      legalName: String,
      gstin: String,
      address: String,
      stateCode: String,
      sacCode: String,
    },
    recipient: { businessName: String, gstin: String, address: String, stateCode: String },
    lines: [lineSchema],
    taxablePaise: paise, // total commission
    gst: {
      rateBps: { type: Number, required: true },
      intraState: Boolean,
      cgstPaise: paise,
      sgstPaise: paise,
      igstPaise: paise,
      totalPaise: paise,
    },
    totalPaise: paise, // taxable + GST
    fromTokensPaise: paise, // already kept from buyers' tokens
    balanceDuePaise: paise, // total − kept from tokens (never below 0)
    status: {
      type: String,
      enum: values(COMMISSION_INVOICE_STATUS),
      default: COMMISSION_INVOICE_STATUS.ISSUED,
    },
    paidAt: Date,
  },
  { timestamps: true },
);

commissionInvoiceSchema.index({ invoiceNo: 1 }, { unique: true });
commissionInvoiceSchema.index({ sellerId: 1, 'period.key': 1 }, { unique: true });
commissionInvoiceSchema.index({ 'period.key': 1, issuedAt: -1 });

module.exports = model('CommissionInvoice', commissionInvoiceSchema);
