/**
 * Notification model — the in-app notification centre (PRD §13 `notifications`, LIV-4).
 * Title and body are stored in the user's language at send time. Old notifications are
 * removed after 90 days.
 */
const { Schema, model } = require('mongoose');
const { NOTIFICATION_TYPE, values } = require('../constants/enums');

const TTL_SECONDS = 90 * 24 * 60 * 60;

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: values(NOTIFICATION_TYPE), required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 400 },
    // e.g. { groupId, url: '/group/<id>' } — the app opens `url` when tapped
    data: { type: Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false },
    readAt: Date,
    // Push delivery (in-app always exists)
    push: {
      status: { type: String, enum: ['none', 'sent', 'deferred', 'failed'], default: 'none' },
      sendAfter: Date, // quiet hours: sent at 08:00 IST
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS });

module.exports = model('Notification', notificationSchema);
