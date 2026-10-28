/**
 * Bid model — one dealer price in a group's live reverse auction (PRD §10.5, §13 `bids`).
 * Bids are permanent (AUC-7): price fields are immutable and bids can never be deleted.
 * Only `status` and `analysis` change after creation.
 * (The roadmap's "Offer" schema is this model — the PRD data model calls it `bids`.)
 */
const { Schema, model } = require('mongoose');
const { BID_STATUS, values } = require('../constants/enums');
const { paiseValidator } = require('./shared.schemas');
const appendOnlyPlugin = require('./plugins/appendOnly.plugin');

/** Paise field that can never change after the bid is placed. */
const lockedPaise = { type: Number, min: 0, default: 0, immutable: true, validate: paiseValidator };

// Required all-inclusive breakdown so dealers cannot hide charges (AUC-3)
const breakdownSchema = new Schema(
  {
    basePaise: lockedPaise, // ex-showroom / base price
    discountPaise: lockedPaise,
    taxPaise: lockedPaise,
    rtoPaise: lockedPaise,
    insurancePaise: lockedPaise,
    accessoriesPaise: lockedPaise,
    handlingPaise: lockedPaise,
    warrantyPaise: lockedPaise,
    deliveryPaise: lockedPaise,
  },
  { _id: false },
);

const bidSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true, immutable: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller', required: true, immutable: true },
    placedBy: { type: Schema.Types.ObjectId, ref: 'User', immutable: true }, // seller owner or staff
    pricePerUnitPaise: {
      type: Number,
      required: true,
      immutable: true,
      validate: paiseValidator,
    },
    breakdown: { type: breakdownSchema, required: true },
    inclusions: { type: [String], immutable: true },
    validTill: { type: Date, required: true, immutable: true },
    deliveryBy: { type: Date, immutable: true },
    terms: { type: String, trim: true, maxlength: 2000, immutable: true },
    analysis: {
      flags: [String],
      summary: String,
    },
    status: { type: String, enum: values(BID_STATUS), default: BID_STATUS.ACTIVE },
    // Fraud signals (Trust AI, suspicious bidding alert)
    ip: { type: String, immutable: true },
    deviceId: { type: String, immutable: true },
  },
  { timestamps: true },
);

bidSchema.plugin(appendOnlyPlugin, { allowUpdates: true });

// Lowest price first, earliest bid wins a tie (PRD §10.5 "Winner")
bidSchema.index({ groupId: 1, pricePerUnitPaise: 1, createdAt: 1 });
bidSchema.index({ sellerId: 1, createdAt: -1 });

module.exports = model('Bid', bidSchema);
