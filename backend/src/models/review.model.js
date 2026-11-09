/**
 * Review model — a buyer rates the dealer after a completed purchase (TRU-2, PRD §13
 * `reviews`). One review per purchase; only completed buyers can review.
 */
const { Schema, model } = require('mongoose');

const reviewSchema = new Schema(
  {
    purchaseId: { type: Schema.Types.ObjectId, ref: 'Purchase', required: true, immutable: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller', required: true, immutable: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', immutable: true },
    rating: { type: Number, required: true, min: 1, max: 5, immutable: true },
    text: { type: String, trim: true, maxlength: 1000 },
    // Trust AI (Day 19) and reports (Day 12)
    flags: [String],
    status: { type: String, enum: ['published', 'hidden'], default: 'published' },
  },
  { timestamps: true },
);

reviewSchema.index({ purchaseId: 1 }, { unique: true });
reviewSchema.index({ sellerId: 1, status: 1, createdAt: -1 });

module.exports = model('Review', reviewSchema);
