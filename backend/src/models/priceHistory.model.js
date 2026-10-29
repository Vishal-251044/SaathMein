/**
 * PriceHistory model — every price a product had in a city, over time (CAT-5).
 * Written on each admin/CSV price change today; offers and tiers add points later
 * (Days 9–10). Feeds Price Insights and the Deal Predictor (Day 17). Append-only.
 */
const { Schema, model } = require('mongoose');
const { PRICE_SOURCE, values } = require('../constants/enums');
const { paiseValidator } = require('./shared.schemas');
const appendOnlyPlugin = require('./plugins/appendOnly.plugin');

const priceHistorySchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantKey: { type: String, default: null },
    cityId: { type: Schema.Types.ObjectId, ref: 'City', required: true },
    date: { type: Date, default: Date.now },
    // Headline price used for charts: on-road, else ex-showroom, else MRP
    pricePaise: { type: Number, required: true, validate: paiseValidator },
    mrpPaise: { type: Number, validate: paiseValidator },
    exShowroomPaise: { type: Number, validate: paiseValidator },
    onRoadPaise: { type: Number, validate: paiseValidator },
    source: { type: String, enum: values(PRICE_SOURCE), required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

priceHistorySchema.plugin(appendOnlyPlugin);
priceHistorySchema.index({ productId: 1, cityId: 1, variantKey: 1, date: -1 });

module.exports = model('PriceHistory', priceHistorySchema);
