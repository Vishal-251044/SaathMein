/**
 * SellerStaff model — who can act for a seller (PRD §13 `sellerStaff`, F31).
 * Owner: everything incl. KYC, bank, team. Staff: auctions, deals, purchases (PRD §8.2).
 */
const { Schema, model } = require('mongoose');

const SELLER_ROLES = ['owner', 'staff'];

const sellerStaffSchema = new Schema(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: SELLER_ROLES, required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['active', 'removed'], default: 'active' },
    removedAt: Date,
  },
  { timestamps: true },
);

sellerStaffSchema.index({ sellerId: 1, userId: 1 }, { unique: true });
sellerStaffSchema.index({ userId: 1, status: 1 });

sellerStaffSchema.statics.SELLER_ROLES = SELLER_ROLES;

module.exports = model('SellerStaff', sellerStaffSchema);
