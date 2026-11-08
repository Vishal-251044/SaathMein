/**
 * GroupMember model — one buyer's membership in one group, with their token payment
 * and deal code. PRD §13 `groupMembers`. A user can have only one membership per group.
 */
const { Schema, model } = require('mongoose');
const { MEMBER_STATUS, values } = require('../constants/enums');

const groupMemberSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: values(MEMBER_STATUS), default: MEMBER_STATUS.ACTIVE },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    dealCode: { type: String, trim: true, uppercase: true }, // issued when the auction is won
    waitlistPosition: { type: Number, min: 1 },
    // A freed seat is offered to this waitlisted person until this time (2 h)
    offerExpiresAt: Date,
    joinedAt: { type: Date, default: Date.now },
    leftAt: Date,
  },
  { timestamps: true },
);

groupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });
groupMemberSchema.index({ userId: 1, status: 1 }); // "My Groups"
groupMemberSchema.index({ groupId: 1, status: 1, waitlistPosition: 1 });
groupMemberSchema.index(
  { dealCode: 1 },
  { unique: true, partialFilterExpression: { dealCode: { $type: 'string' } } },
);

module.exports = model('GroupMember', groupMemberSchema);
