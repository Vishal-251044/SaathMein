/**
 * Seller model — a dealer or shop business. Users act for a seller through
 * sellerStaff (owner / staff roles, added on Day 5). PRD §13 `sellers`, TRU-1.
 */
const { Schema, model } = require('mongoose');
const { ACCOUNT_STATUS, KYC_STATUS, SELLER_PLAN, values } = require('../constants/enums');
const { imageSchema, pointSchema } = require('./shared.schemas');

const kycDocSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['gst_certificate', 'pan', 'shop_photo', 'dealer_proof', 'address_proof', 'other'],
      required: true,
    },
    url: { type: String, required: true },
    publicId: String,
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const penaltySchema = new Schema(
  {
    type: {
      type: String,
      enum: ['warning', 'rating_penalty', 'auction_suspension'],
      required: true,
    },
    reason: { type: String, required: true, trim: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group' },
    until: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const sellerSchema = new Schema(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    businessName: { type: String, required: true, trim: true, maxlength: 120 },
    // 15-char GSTIN and 10-char PAN, stored uppercase
    gstin: { type: String, trim: true, uppercase: true, match: /^[0-9A-Z]{15}$/ },
    pan: { type: String, trim: true, uppercase: true, match: /^[A-Z]{5}\d{4}[A-Z]$/ },
    address: {
      line1: { type: String, trim: true },
      line2: { type: String, trim: true },
      area: { type: String, trim: true },
      cityId: { type: Schema.Types.ObjectId, ref: 'City' },
      pincode: { type: String, trim: true, match: /^\d{6}$/ },
    },
    geo: pointSchema, // shop location for "near you" and distance
    photos: [imageSchema],

    // Coverage: where and what this dealer can sell (auction eligibility)
    categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    cities: [{ type: Schema.Types.ObjectId, ref: 'City' }],

    kyc: {
      status: { type: String, enum: values(KYC_STATUS), default: KYC_STATUS.NOT_SUBMITTED },
      docs: [kycDocSchema],
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: Date,
      rejectionReason: { type: String, trim: true },
    },

    // Razorpay Route linked account (payouts, PAY-4)
    razorpayAccountId: { type: String, trim: true },

    rating: { type: Number, min: 0, max: 5, default: 0 },
    ratingCount: { type: Number, min: 0, default: 0 },
    plan: { type: String, enum: values(SELLER_PLAN), default: SELLER_PLAN.FREE },
    penalties: [penaltySchema],
    status: { type: String, enum: values(ACCOUNT_STATUS), default: ACCOUNT_STATUS.ACTIVE },
  },
  { timestamps: true },
);

sellerSchema.index({ ownerUserId: 1 });
sellerSchema.index({ geo: '2dsphere' });
// Auction eligibility lookup: verified dealers covering a city + category
sellerSchema.index({ cities: 1, categories: 1, 'kyc.status': 1, status: 1 });
sellerSchema.index(
  { gstin: 1 },
  { unique: true, partialFilterExpression: { gstin: { $type: 'string' } } },
);

module.exports = model('Seller', sellerSchema);
