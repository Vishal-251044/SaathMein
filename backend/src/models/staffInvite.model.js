/**
 * StaffInvite model — an emailed invitation to join the SaathMein staff (Admin Console
 * Team, ADL-1). There is no public staff sign-up: the Owner invites by email with a role,
 * the invitee sets a name and password, then sets up 2FA on first login.
 * Only a keyed hash of the invite token is stored; invites expire after 72 hours.
 */
const { Schema, model } = require('mongoose');
const { STAFF_ROLE } = require('../constants/enums');

// The Owner is created only by `npm run create-owner`, never invited
const INVITABLE_ROLES = Object.values(STAFF_ROLE).filter((role) => role !== STAFF_ROLE.OWNER);

const staffInviteSchema = new Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    role: { type: String, enum: INVITABLE_ROLES, required: true },
    tokenHash: { type: String, required: true, select: false },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'revoked'], default: 'pending' },
    expiresAt: { type: Date, required: true },
    acceptedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    acceptedAt: Date,
  },
  { timestamps: true },
);

staffInviteSchema.index({ tokenHash: 1 }, { unique: true });
staffInviteSchema.index({ status: 1, createdAt: -1 });
// Remove old invites 30 days after they expire
staffInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = model('StaffInvite', staffInviteSchema);
module.exports.INVITABLE_ROLES = INVITABLE_ROLES;
