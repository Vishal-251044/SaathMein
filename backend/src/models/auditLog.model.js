/**
 * AuditLog model — every staff action in the admin console (ADL-5, PRD §13 `auditLogs`):
 * who, what, before / after, when, from where. Append-only: never edited or deleted.
 * Money actions carry a reason note (enforced by their routes, Day 7+).
 */
const { Schema, model } = require('mongoose');
const appendOnlyPlugin = require('./plugins/appendOnly.plugin');

const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String, trim: true }, // staff role at the time of the action
    action: { type: String, required: true, trim: true }, // e.g. "seller.kyc.approve"
    targetType: { type: String, trim: true }, // e.g. "seller", "product", "category"
    targetId: { type: String, trim: true },
    reason: { type: String, trim: true, maxlength: 1000 },
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    method: String,
    path: String,
    statusCode: Number,
    ip: String,
    userAgent: { type: String, maxlength: 300 },
    requestId: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.plugin(appendOnlyPlugin);
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = model('AuditLog', auditLogSchema);
