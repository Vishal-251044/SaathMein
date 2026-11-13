/**
 * Message model — group chat (PRD §13 `messages`, LIV-5): text, images, polls (leader),
 * pinned messages and reports. Messages reported by several members are hidden until
 * Support reviews them. Index `{ groupId, createdAt }` (PRD important indexes).
 */
const { Schema, model } = require('mongoose');

const pollOptionSchema = new Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 80 },
    votes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { _id: false },
);

const messageSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User' }, // null for system messages
    senderType: { type: String, enum: ['buyer', 'seller', 'saathi', 'system'], default: 'buyer' },
    // Dealer messages show the business name (never the staff member's own name)
    senderLabel: { type: String, trim: true, maxlength: 120 },
    text: { type: String, trim: true, maxlength: 1000 },
    images: [
      {
        _id: false,
        publicId: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
    poll: {
      type: new Schema(
        {
          question: { type: String, required: true, trim: true, maxlength: 200 },
          options: {
            type: [pollOptionSchema],
            validate: (list) => list.length >= 2 && list.length <= 6,
          },
          closed: { type: Boolean, default: false },
        },
        { _id: false },
      ),
      default: undefined,
    },
    pinned: { type: Boolean, default: false },
    reports: [
      {
        _id: false,
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String, trim: true, maxlength: 200 },
        at: { type: Date, default: Date.now },
      },
    ],
    hidden: { type: Boolean, default: false }, // too many reports → waiting for Support
  },
  { timestamps: true },
);

messageSchema.index({ groupId: 1, createdAt: -1 });
messageSchema.index({ groupId: 1, pinned: 1 });
messageSchema.index({ hidden: 1, updatedAt: -1 }); // Support review queue (Day 12)

module.exports = model('Message', messageSchema);
