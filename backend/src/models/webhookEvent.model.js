/**
 * WebhookEvent model — every Razorpay webhook event we received, keyed by its event id
 * (x-razorpay-event-id). Makes webhook handling idempotent (PAY-2): an event is processed
 * once; a failed one can be retried by Razorpay's redelivery.
 */
const { Schema, model } = require('mongoose');

const webhookEventSchema = new Schema(
  {
    eventId: { type: String, required: true, trim: true },
    event: { type: String, required: true, trim: true }, // e.g. payment.captured
    status: {
      type: String,
      enum: ['processing', 'processed', 'ignored', 'failed'],
      default: 'processing',
    },
    entityId: { type: String, trim: true }, // payment / refund / transfer / settlement id
    error: { type: String, trim: true },
    attempts: { type: Number, default: 1, min: 1 },
    processedAt: Date,
  },
  { timestamps: true },
);

webhookEventSchema.index({ eventId: 1 }, { unique: true });
webhookEventSchema.index({ status: 1, createdAt: -1 });

module.exports = model('WebhookEvent', webhookEventSchema);
