/**
 * SellerInvite model — an emailed invitation to join a seller's team (F31).
 * Only a keyed hash of the invite token is stored; invites expire after 7 days.
 */
const { Schema, model } = require('mongoose');

const sellerInviteSchema = new Schema(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller', required: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, trim: true, maxlength: 80 },
    tokenHash: { type: String, required: true, select: false },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'revoked'], default: 'pending' },
    expiresAt: { type: Date, required: true },
    acceptedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    acceptedAt: Date,
  },
  { timestamps: true },
);

sellerInviteSchema.index({ tokenHash: 1 }, { unique: true });
sellerInviteSchema.index({ sellerId: 1, status: 1 });
// Remove old invites 30 days after they expire
sellerInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = model('SellerInvite', sellerInviteSchema);
