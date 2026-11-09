/**
 * AuctionDealer model — a dealer who joined one group's auction (PRD §13 `auctionDealers`,
 * AUC-2). Joining means accepting the commitment: honour the price for every member,
 * stock for the group size, deliver by a date, keep the price valid 7–15 days.
 * One row per group + dealer.
 */
const { Schema, model } = require('mongoose');

const AUCTION_DEALER_STATUS = [
  'joined',
  'leading',
  'outbid',
  'won',
  'runner_up',
  'lost',
  'backed_out',
];

const auctionDealerSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller', required: true },
    joinedBy: { type: Schema.Types.ObjectId, ref: 'User' }, // owner or staff who pressed Join
    joinedAt: { type: Date, default: Date.now },
    commitmentAccepted: { type: Boolean, required: true },
    deliveryBy: { type: Date, required: true },
    priceValidityDays: { type: Number, min: 7, max: 15, required: true },
    status: { type: String, enum: AUCTION_DEALER_STATUS, default: 'joined' },
    // This dealer's lowest price so far and when they first bid
    bestPricePaise: Number,
    firstBidAt: Date,
    bidCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

auctionDealerSchema.index({ groupId: 1, sellerId: 1 }, { unique: true });
auctionDealerSchema.index({ sellerId: 1, status: 1, updatedAt: -1 });

auctionDealerSchema.statics.STATUSES = AUCTION_DEALER_STATUS;

module.exports = model('AuctionDealer', auctionDealerSchema);
