/**
 * Session model — one login on one device, for buyers/sellers (app) or staff (admin).
 * Holds a keyed hash of the CURRENT refresh token; every refresh rotates it. Hashes of
 * already-used tokens are kept so a stolen, replayed token can be detected and the whole
 * session revoked (refresh token reuse detection).
 * Expired sessions are removed automatically by a TTL index.
 */
const { Schema, model } = require('mongoose');
const { TOKEN_AUDIENCE, values } = require('../constants/enums');

const MAX_USED_HASHES = 20;

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    audience: {
      type: String,
      enum: values(TOKEN_AUDIENCE).filter((aud) => aud !== TOKEN_AUDIENCE.STAFF_2FA),
      required: true,
    },
    refreshTokenHash: { type: String, required: true, select: false },
    usedTokenHashes: { type: [String], select: false, default: [] },

    expiresAt: { type: Date, required: true },
    lastActivityAt: { type: Date, default: Date.now }, // staff idle timeout
    revokedAt: Date,
    revokedReason: {
      type: String,
      enum: ['logout', 'reuse_detected', 'idle_timeout', 'suspended', 'admin'],
    },

    // Device context (Trust AI and new-device alerts)
    deviceId: { type: String, trim: true, maxlength: 128 },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true },
);

sessionSchema.index({ userId: 1, audience: 1, revokedAt: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

sessionSchema.statics.MAX_USED_HASHES = MAX_USED_HASHES;

module.exports = model('Session', sessionSchema);
