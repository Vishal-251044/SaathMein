/**
 * Seller model — a dealer or shop business (PRD §13 `sellers`, TRU-1).
 * People act for a seller through sellerStaff (owner / staff). KYC documents are private
 * Cloudinary assets; bank details go only to Razorpay (we keep the last 4 digits + IFSC).
 */
const { Schema, model } = require('mongoose');
const { ACCOUNT_STATUS, KYC_STATUS, SELLER_PLAN, values } = require('../constants/enums');
const { imageSchema, pointSchema } = require('./shared.schemas');

const KYC_DOC_TYPES = [
  'gst_certificate',
  'pan_card',
  'shop_photo',
  'dealer_proof',
  'address_proof',
  'cancelled_cheque',
  'other',
];
const BUSINESS_TYPES = [
  'proprietorship',
  'partnership',
  'private_limited',
  'public_limited',
  'llp',
];
const ROUTE_STATUSES = [
  'not_started',
  'created',
  'requested',
  'under_review',
  'needs_clarification',
  'activated',
  'suspended',
  'failed',
];

const kycDocSchema = new Schema(
  {
    type: { type: String, enum: KYC_DOC_TYPES, required: true },
    publicId: { type: String, required: true }, // private (authenticated) Cloudinary asset
    format: { type: String, trim: true }, // jpg, png, pdf
    version: Number,
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true },
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
    businessType: { type: String, enum: BUSINESS_TYPES },
    contactName: { type: String, trim: true, maxlength: 80 },
    // Business contact phone (not a login; not OTP-verified — checked during KYC review)
    contactPhone: { type: String, trim: true, match: /^\+91[6-9]\d{9}$/ },
    contactEmail: { type: String, trim: true, lowercase: true },
    // 15-char GSTIN and 10-char PAN, stored uppercase
    gstin: { type: String, trim: true, uppercase: true, match: /^[0-9A-Z]{15}$/ },
    pan: { type: String, trim: true, uppercase: true, match: /^[A-Z]{5}\d{4}[A-Z]$/ },
    address: {
      line1: { type: String, trim: true, maxlength: 100 },
      line2: { type: String, trim: true, maxlength: 100 },
      area: { type: String, trim: true },
      cityId: { type: Schema.Types.ObjectId, ref: 'City' },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true, match: /^\d{6}$/ },
    },
    geo: pointSchema, // shop location for "near you" and distance
    photos: [imageSchema],

    // Coverage: where and what this dealer sells (auction eligibility, AUC-1)
    categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    cities: [{ type: Schema.Types.ObjectId, ref: 'City' }],

    kyc: {
      status: { type: String, enum: values(KYC_STATUS), default: KYC_STATUS.NOT_SUBMITTED },
      docs: [kycDocSchema],
      submittedAt: Date,
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: Date,
      rejectionReason: { type: String, trim: true },
    },

    // Payout bank — only a masked copy; full details live at Razorpay
    bank: {
      accountLast4: { type: String, trim: true, match: /^\d{4}$/ },
      ifsc: { type: String, trim: true, uppercase: true, match: /^[A-Z]{4}0[A-Z0-9]{6}$/ },
      beneficiaryName: { type: String, trim: true, maxlength: 120 },
    },

    // Razorpay Route linked account (PAY-4 transfers to the dealer)
    razorpayAccountId: { type: String, trim: true },
    razorpay: {
      stakeholderId: String,
      productId: String, // Route product configuration id
      settlementsConfigured: { type: Boolean, default: false }, // bank account accepted by Razorpay
      status: { type: String, enum: ROUTE_STATUSES, default: 'not_started' },
      lastError: { type: String, trim: true, maxlength: 500 },
      updatedAt: Date,
    },

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
sellerSchema.index({ 'kyc.status': 1, 'kyc.submittedAt': 1 }); // admin KYC queue
sellerSchema.index(
  { gstin: 1 },
  { unique: true, partialFilterExpression: { gstin: { $type: 'string' } } },
);

sellerSchema.statics.KYC_DOC_TYPES = KYC_DOC_TYPES;
sellerSchema.statics.BUSINESS_TYPES = BUSINESS_TYPES;

module.exports = model('Seller', sellerSchema);
