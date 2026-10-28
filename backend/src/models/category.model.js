/**
 * Category model — tree of product categories (e.g. Vehicles → Cars → EV).
 * Each category carries its own business rules: group sizes, token amount,
 * deadline range, auction settings, commission and back-out fee (CAT-1).
 * All rules are editable by admin; code must read them from here, never hardcode.
 */
const { Schema, model } = require('mongoose');
const { COMMISSION_TYPE, values } = require('../constants/enums');
const { paiseValidator } = require('./shared.schemas');

const rulesSchema = new Schema(
  {
    minSize: { type: Number, min: 2, default: 5 },
    maxSize: { type: Number, min: 2, default: 25 },
    tokenAmountPaise: { type: Number, default: 0, validate: paiseValidator },
    deadlineDays: {
      min: { type: Number, min: 1, default: 3 },
      max: { type: Number, min: 1, default: 30 },
    },
    // Reverse auction defaults (PRD §10.5 rules table)
    auction: {
      durationHours: { type: Number, min: 1, default: 24 },
      minDurationHours: { type: Number, min: 1, default: 6 },
      maxDurationHours: { type: Number, min: 1, default: 72 },
      minStepPaise: { type: Number, default: 20000, validate: paiseValidator }, // ₹200
      minStepBps: { type: Number, min: 0, default: 25 }, // 0.25% — whichever is higher
      antiSnipeMinutes: { type: Number, min: 0, default: 5 },
      maxExtensions: { type: Number, min: 0, default: 6 },
      minDealers: { type: Number, min: 1, default: 2 },
      priceValidityDays: { type: Number, min: 1, default: 7 },
    },
    commission: {
      type: { type: String, enum: values(COMMISSION_TYPE), default: COMMISSION_TYPE.PERCENT },
      // FLAT → paise per unit; PERCENT → basis points (250 = 2.5%)
      value: { type: Number, min: 0, default: 0 },
    },
    backoutFeePaise: { type: Number, default: 9900, validate: paiseValidator }, // ₹99
  },
  { _id: false },
);

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 }, // English
    nameTranslations: {
      hi: { type: String, trim: true, maxlength: 80 },
      mr: { type: String, trim: true, maxlength: 80 },
    },
    slug: { type: String, required: true, trim: true, lowercase: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    icon: { type: String, trim: true }, // Lucide icon name, e.g. "car", "smartphone"
    // Popular brands offered in interest onboarding until real products exist (Day 4)
    featuredBrands: [{ type: String, trim: true, maxlength: 60 }],
    rules: { type: rulesSchema, default: () => ({}) },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ parentId: 1, order: 1 });

module.exports = model('Category', categorySchema);
