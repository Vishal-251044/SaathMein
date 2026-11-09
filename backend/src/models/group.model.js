/**
 * Group model — buyers who want the same product in the same city, buying together.
 * Buyer-led groups go to a live dealer auction when full; seller-led groups use
 * fixed discount tiers. PRD §13 `groups`, §10.3, §10.5.
 *
 * IMPORTANT: `status` may only be changed by services/groups/stateMachine.js.
 */
const { Schema, model } = require('mongoose');
const { GROUP_STATUS, GROUP_TYPE, GROUP_VISIBILITY, values } = require('../constants/enums');
const { paiseValidator } = require('./shared.schemas');

const tierSchema = new Schema(
  {
    size: { type: Number, required: true, min: 2 }, // members needed to unlock
    discountBps: { type: Number, required: true, min: 1, max: 10000 }, // 700 = 7% off
  },
  { _id: false },
);

const auctionSchema = new Schema(
  {
    startsAt: Date,
    endsAt: Date,
    extensions: { type: Number, default: 0, min: 0 },
    ceilingPricePaise: { type: Number, validate: paiseValidator }, // first bid must be below this
    minStepPaise: { type: Number, validate: paiseValidator },
    minStepBps: { type: Number, min: 0 },
    lowestBidId: { type: Schema.Types.ObjectId, ref: 'Bid' },
    lowestPricePaise: { type: Number, validate: paiseValidator },
    dealerCount: { type: Number, default: 0, min: 0 },
    winnerBidId: { type: Schema.Types.ObjectId, ref: 'Bid' },
    runnerUpBidId: { type: Schema.Types.ObjectId, ref: 'Bid' },
    pausedAt: Date,
    bidCount: { type: Number, default: 0, min: 0 },
    joinedDealerCount: { type: Number, default: 0, min: 0 },
    // Minimum-dealers rule: extended once by 24 h when fewer than 2 dealers bid
    minDealerExtensionUsed: { type: Boolean, default: false },
    // Bidding stopped (time up) while waiting for the leader (single dealer) or runner-up
    closedAt: Date,
    singleBidDecisionDueAt: Date,
    runnerUpOfferDueAt: Date,
    lastPriceAlertAt: Date, // "new lowest price" push throttle for buyers
  },
  { _id: false },
);

const predictionSchema = new Schema(
  {
    discountNowBps: Number,
    discountNextBps: Number,
    fillProbability: { type: Number, min: 0, max: 1 },
    updatedAt: Date,
  },
  { _id: false },
);

const groupSchema = new Schema(
  {
    type: { type: String, enum: values(GROUP_TYPE), required: true },
    visibility: {
      type: String,
      enum: values(GROUP_VISIBILITY),
      default: GROUP_VISIBILITY.PUBLIC,
    },
    inviteCode: { type: String, trim: true, uppercase: true }, // community groups and share links
    requiresApproval: { type: Boolean, default: false }, // community: leader approves members (GRP-6)

    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantKey: { type: String, trim: true }, // null = "any variant"
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    cityId: { type: Schema.Types.ObjectId, ref: 'City', required: true },
    leaderId: { type: Schema.Types.ObjectId, ref: 'User' }, // buyer-led
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller' }, // seller-led, or auction winner
    note: { type: String, trim: true, maxlength: 500 },

    targetSize: { type: Number, required: true, min: 2 },
    maxSize: { type: Number, min: 2 },
    memberCount: { type: Number, default: 0, min: 0 },
    tokenAmountPaise: { type: Number, required: true, validate: paiseValidator }, // snapshot at creation
    // Kept from the token when a member leaves after seats lock (snapshot at creation, PAY-3)
    backoutFeePaise: { type: Number, default: 0, validate: paiseValidator },
    tiers: [tierSchema],
    // Seller-led deals: price per unit before tier discounts (AUC-9)
    basePricePaise: { type: Number, validate: paiseValidator },
    // After a win: members may leave (refund minus back-out fee) until this time
    exitWindowEndsAt: Date,
    winningPricePaise: { type: Number, validate: paiseValidator },

    deadline: { type: Date, required: true },
    deadlineExtended: { type: Boolean, default: false }, // leader may extend once (GRP-5)
    // Deadline passed at ≥70% of target: the leader chooses extend / start early until this time
    leaderDecisionDueAt: Date,
    // "Deadline in 24 h" reminder already sent (notification sweep)
    deadlineReminderSentAt: Date,
    status: { type: String, enum: values(GROUP_STATUS), default: GROUP_STATUS.OPEN },
    statusHistory: [
      {
        _id: false,
        from: String,
        to: String,
        reason: String,
        byType: { type: String, enum: ['system', 'user', 'staff'] }, // who caused it
        by: { type: Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
      },
    ],

    auction: { type: auctionSchema, default: undefined },
    prediction: { type: predictionSchema, default: undefined },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Status may only change through services/groups/stateMachine.js (CLAUDE.md §8): saves
// and updates that touch `status` without the state machine flag are refused.
groupSchema.pre('save', function guardStatusOnSave() {
  if (!this.isNew && this.isModified('status')) {
    throw new Error('Group status must be changed through the state machine');
  }
  if (this.isNew && this.status !== GROUP_STATUS.OPEN) {
    throw new Error('New groups must start open');
  }
});
groupSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function guardStatusOnUpdate() {
  const update = this.getUpdate() || {};
  const touchesStatus =
    'status' in update || 'status' in (update.$set || {}) || 'status' in (update.$unset || {});
  if (touchesStatus && !this.getOptions().stateMachine) {
    throw new Error('Group status must be changed through the state machine');
  }
});

// Indexes from PRD §13
groupSchema.index({ cityId: 1, status: 1, deadline: 1 });
groupSchema.index({ productId: 1, cityId: 1, status: 1 });
groupSchema.index({ leaderId: 1, createdAt: -1 });
groupSchema.index(
  { inviteCode: 1 },
  { unique: true, partialFilterExpression: { inviteCode: { $type: 'string' } } },
);
// Deadline sweep: open groups whose deadline or leader decision window has passed
groupSchema.index({ status: 1, leaderDecisionDueAt: 1 });
// Auction close job looks up live auctions by end time
groupSchema.index({ status: 1, 'auction.endsAt': 1 });

module.exports = model('Group', groupSchema);
