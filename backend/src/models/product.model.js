/**
 * Product model — a catalog item with variants, specs, images and per-city prices.
 * PRD §13 `products`, CAT-2. Prices are per city AND per variant (variantKey null = the
 * product's base price). Every price change is also written to priceHistory (CAT-5).
 * The embedding vector (Smart Match, Day 16) is stored here but never returned by default.
 */
const { Schema, model } = require('mongoose');
const { imageSchema, paiseValidator } = require('./shared.schemas');

const variantSchema = new Schema(
  {
    key: { type: String, required: true, trim: true }, // stable id, e.g. "std-white"
    name: { type: String, required: true, trim: true }, // shown to users, e.g. "Standard, Pearl White"
    attrs: { type: Map, of: String }, // e.g. { trim: "Standard", colour: "Pearl White" }
  },
  { _id: false },
);

const cityPriceSchema = new Schema(
  {
    cityId: { type: Schema.Types.ObjectId, ref: 'City', required: true },
    variantKey: { type: String, trim: true, default: null }, // null = applies to the whole product
    mrpPaise: { type: Number, validate: paiseValidator },
    exShowroomPaise: { type: Number, validate: paiseValidator },
    onRoadPaise: { type: Number, validate: paiseValidator }, // vehicles: ex-showroom + RTO + insurance
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    brand: { type: String, required: true, trim: true, maxlength: 60 },
    model: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, trim: true, maxlength: 2000 },
    variants: [variantSchema],
    specs: { type: Map, of: Schema.Types.Mixed }, // flexible key specs per category
    images: [imageSchema],
    priceByCity: [cityPriceSchema],
    tags: [{ type: String, trim: true, lowercase: true }],
    embedding: { type: [Number], select: false },
    active: { type: Boolean, default: true },
    // Set by imports with unverified prices; cleared when staff switch the product on
    needsPriceReview: { type: Boolean, default: false },
  },
  { timestamps: true },
);

productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ active: 1, brand: 1, model: 1 });
productSchema.index({ needsPriceReview: 1, updatedAt: -1 });
productSchema.index({ categoryId: 1, active: 1 });
// Text-index fallback for search when Atlas Search is unavailable (DIS-2)
productSchema.index(
  { brand: 'text', model: 'text', tags: 'text' },
  { weights: { model: 5, brand: 3, tags: 1 }, name: 'product_text_search' },
);

module.exports = model('Product', productSchema);
