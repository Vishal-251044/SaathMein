/**
 * User model — one account for buyers, dealers (via sellerStaff) and staff (via staffRole).
 * Buyers sign in with phone OTP; dealers and staff also have email + password.
 * PRD §13 `users`.
 */
const { Schema, model } = require('mongoose');
const {
  ACCOUNT_STATUS,
  STAFF_ROLE,
  LANGUAGE,
  BUYING_TIMELINE,
  values,
} = require('../constants/enums');
const { imageSchema, paiseValidator } = require('./shared.schemas');

const interestsSchema = new Schema(
  {
    categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    products: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    // Brands picked during onboarding, before products exist (ACC-3 "products or brands")
    brands: [{ type: String, trim: true, maxlength: 60 }],
    budgetMinPaise: { type: Number, validate: paiseValidator },
    budgetMaxPaise: { type: Number, validate: paiseValidator },
    timeline: { type: String, enum: values(BUYING_TIMELINE) },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 80 },
    // E.164 format, e.g. +919876543210. Optional only for staff created by script.
    phone: { type: String, trim: true, match: /^\+[1-9]\d{7,14}$/ },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    firebaseUid: { type: String, trim: true },
    avatar: imageSchema,

    cityId: { type: Schema.Types.ObjectId, ref: 'City' },
    area: { type: String, trim: true },
    pincode: { type: String, trim: true, match: /^\d{6}$/ },
    language: { type: String, enum: values(LANGUAGE), default: LANGUAGE.EN },
    interests: { type: interestsSchema, default: () => ({}) },

    // Dealer and staff login (never returned unless explicitly selected)
    passwordHash: { type: String, select: false },
    // Email ownership check for dealer accounts (6-digit code, stored hashed)
    emailVerifiedAt: Date,
    emailVerification: {
      type: { _id: false, codeHash: String, expiresAt: Date, attempts: Number, sentAt: Date },
      select: false,
      default: undefined,
    },

    // Admin console access (PRD §8.2). Absent for buyers and dealers.
    staffRole: { type: String, enum: values(STAFF_ROLE) },
    // TOTP secret, AES-256-GCM encrypted (ADL-2). Pending = set up but not yet confirmed.
    twoFactorSecret: { type: String, select: false },
    twoFactorPendingSecret: { type: String, select: false },
    twoFactorEnabled: { type: Boolean, default: false },
    // Last accepted TOTP time step — a code can never be used twice
    twoFactorLastStep: { type: Number, select: false },
    // One-time backup codes, stored as keyed hashes
    twoFactorBackupCodes: {
      type: [{ _id: false, hash: String, usedAt: Date }],
      select: false,
      default: undefined,
    },

    // Login lockout after repeated failures (ADL-4)
    failedLoginCount: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    passwordChangedAt: Date,

    status: { type: String, enum: values(ACCOUNT_STATUS), default: ACCOUNT_STATUS.ACTIVE },
    referralCode: { type: String, trim: true, uppercase: true },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    walletBalancePaise: { type: Number, default: 0, validate: paiseValidator },
    trustScore: { type: Number, min: 0, max: 100, default: 50 },
    deviceIds: [{ type: String, trim: true }],
    lastLoginAt: Date,
    // Set when the user saves or skips interest onboarding (ACC-3)
    onboardingCompletedAt: Date,
    deletedAt: Date,
  },
  { timestamps: true },
);

// Phone and email are unique when present (staff may have no phone, buyers no email)
userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: 'string' } } },
);
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
);
userSchema.index(
  { firebaseUid: 1 },
  { unique: true, partialFilterExpression: { firebaseUid: { $type: 'string' } } },
);
userSchema.index(
  { referralCode: 1 },
  { unique: true, partialFilterExpression: { referralCode: { $type: 'string' } } },
);
// Exactly one Owner account can exist (ADL-3)
userSchema.index(
  { staffRole: 1 },
  { unique: true, partialFilterExpression: { staffRole: STAFF_ROLE.OWNER } },
);

module.exports = model('User', userSchema);
