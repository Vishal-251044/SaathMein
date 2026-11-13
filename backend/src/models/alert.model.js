/**
 * Alert model — problems the Owner and staff must see (PRD §10.11 Alerts, MON-2, PRD §13
 * `alerts`): payment, auction, suspicious bidding, reconciliation and system. The same
 * problem repeating while the alert is open increases `count` instead of a new alert
 * (`dedupeKey`). Shown in the console bell; emailed to the roles that handle it.
 */
const { Schema, model } = require('mongoose');

const ALERT_TYPES = ['payment', 'auction', 'suspicious_bidding', 'reconciliation', 'system'];

const alertSchema = new Schema(
  {
    type: { type: String, enum: ALERT_TYPES, required: true },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning' },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, trim: true, maxlength: 2000 },
    // What it is about, for the link in the console
    subjectType: {
      type: String,
      enum: ['group', 'payment', 'seller', 'dispute', 'report', 'system'],
    },
    subjectId: { type: String, trim: true },
    dedupeKey: { type: String, required: true, trim: true },
    count: { type: Number, default: 1, min: 1 },
    lastSeenAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['open', 'ack', 'closed'], default: 'open' },
    ackBy: { type: Schema.Types.ObjectId, ref: 'User' },
    ackAt: Date,
    closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    closedAt: Date,
  },
  { timestamps: true },
);

// One open (or acknowledged) alert per problem
alertSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['open', 'ack'] } } },
);
alertSchema.index({ status: 1, createdAt: -1 });
alertSchema.index({ type: 1, createdAt: -1 });

module.exports = model('Alert', alertSchema);
module.exports.ALERT_TYPES = ALERT_TYPES;
