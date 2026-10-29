/**
 * ProductRequest model — "Request a missing product" from buyers (app) and dealers (CAT-3).
 * Deal Managers review the list and add products to the catalog.
 */
const { Schema, model } = require('mongoose');

const productRequestSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller' }, // set when a dealer asks
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    brand: { type: String, required: true, trim: true, maxlength: 60 },
    model: { type: String, required: true, trim: true, maxlength: 120 },
    note: { type: String, trim: true, maxlength: 500 },
    cityId: { type: Schema.Types.ObjectId, ref: 'City' },
    status: { type: String, enum: ['open', 'added', 'rejected'], default: 'open' },
    productId: { type: Schema.Types.ObjectId, ref: 'Product' }, // product created for it
    handledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    handledAt: Date,
  },
  { timestamps: true },
);

productRequestSchema.index({ status: 1, createdAt: -1 });
productRequestSchema.index({ userId: 1, createdAt: -1 });

module.exports = model('ProductRequest', productRequestSchema);
