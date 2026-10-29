/**
 * DemandSignal model — what buyers want, where (PRD §13 `demandSignals`).
 * Recorded from onboarding interests (Day 3), and later from views, searches and Saathi
 * chats. Feeds Smart Match, demand nudges and the seller Demand Radar (Days 16, 19).
 * Signals expire after 180 days (TTL index).
 */
const { Schema, model } = require('mongoose');

const SIGNAL_TYPES = ['view', 'search', 'interest', 'saathi'];
const TTL_SECONDS = 180 * 24 * 60 * 60;

const demandSignalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: SIGNAL_TYPES, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    brand: { type: String, trim: true, maxlength: 60 },
    query: { type: String, trim: true, maxlength: 100 }, // search text (type "search")
    cityId: { type: Schema.Types.ObjectId, ref: 'City' },
    area: { type: String, trim: true },
    budgetMinPaise: Number,
    budgetMaxPaise: Number,
    timeline: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Demand by product/category in a city (Demand Radar, nudges)
demandSignalSchema.index({ cityId: 1, categoryId: 1, type: 1, createdAt: -1 });
demandSignalSchema.index({ cityId: 1, productId: 1, createdAt: -1 });
demandSignalSchema.index({ userId: 1, type: 1 });
demandSignalSchema.index({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS });

demandSignalSchema.statics.SIGNAL_TYPES = SIGNAL_TYPES;

module.exports = model('DemandSignal', demandSignalSchema);
