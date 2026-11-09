/**
 * Dealer bids (AUC-3 to AUC-6). Every bid is checked: the dealer joined and is still
 * eligible, the auction is open, the breakdown adds up to the all-inclusive price, the
 * price is below the ceiling and beats the current lowest by the minimum step (₹200 or
 * 0.25%, whichever is higher, from the category). Inside one transaction the bid is saved
 * and the group's lowest price is swapped only if nobody else changed it meanwhile
 * (compare-and-set on the lowest bid), so two simultaneous bids can never both win.
 * Anti-sniping: a bid in the last 5 minutes extends the timer by 5 minutes (max 6 times).
 * Bids are permanent: no edits, raises or withdrawals.
 */
const Group = require('../../models/group.model');
const Bid = require('../../models/bid.model');
const Seller = require('../../models/seller.model');
const AuctionDealer = require('../../models/auctionDealer.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { withTransaction } = require('../../utils/transaction');
const { formatINR, percentOfPaise } = require('../../utils/money');
const { assertWithinLimit } = require('../rateLimit.service');
const { getAuctionSettings } = require('../settings.service');
const { scheduleAuctionClose } = require('../../jobs/queues');
const { emitToAuction, emitToSeller } = require('../../sockets/emitter');
const { notifyGroupMembers } = require('../groups/groupLive');
const emailService = require('../email.service');
const { ineligibilityReason } = require('./eligibility');
const { auctionRulesFor, auctionNumbers, rankOf } = require('./auction.service');
const { notifyDealer, dealerAuctionUrl, productNameOf } = require('./winner.service');
const {
  BID_STATUS,
  GROUP_STATUS,
  NOTIFICATION_TYPE,
  SOCKET_EVENTS,
} = require('../../constants/enums');

const log = createLogger('BidService');
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const BREAKDOWN_ADD = [
  'basePaise',
  'taxPaise',
  'rtoPaise',
  'insurancePaise',
  'accessoriesPaise',
  'handlingPaise',
  'warrantyPaise',
  'deliveryPaise',
];

/**
 * All-inclusive total of a breakdown: base − discount + every charge.
 * @param {Object} breakdown - Paise fields
 * @returns {number}
 */
const breakdownTotal = (breakdown) =>
  BREAKDOWN_ADD.reduce((sum, key) => sum + (breakdown[key] || 0), 0) -
  (breakdown.discountPaise || 0);

/**
 * The highest price allowed for the next bid.
 * @param {{ lowestPricePaise?: number, ceilingPricePaise?: number, minStepPaise?: number, minStepBps?: number }} auction
 * @returns {{ maxPaise: number|null, stepPaise: number }} maxPaise null = no limit yet
 */
const maxAllowedBid = (auction) => {
  if (auction.lowestPricePaise) {
    const stepPaise = Math.max(
      auction.minStepPaise || 0,
      percentOfPaise(auction.lowestPricePaise, auction.minStepBps || 0),
    );
    return { maxPaise: auction.lowestPricePaise - stepPaise, stepPaise };
  }
  // First bid: strictly below the ceiling
  return {
    maxPaise: auction.ceilingPricePaise ? auction.ceilingPricePaise - 1 : null,
    stepPaise: 0,
  };
};

/**
 * Place a bid.
 * @param {string} groupId - Group in auction_live
 * @param {{ sellerId: string, userId: string }} dealer - Team member bidding for the business
 * @param {{ pricePerUnitPaise: number, breakdown: Object, inclusions?: string[], terms?: string }} input
 * @param {{ ip?: string, now?: Date }} [context]
 * @returns {Promise<Object>} `{ bid, rank, lowestPricePaise, endsAt, extended }`
 * @throws {ApiError} 403 not joined / not eligible, 409 closed / too high / race, 422 breakdown, 429
 */
const placeBid = async (groupId, { sellerId, userId }, input, { ip, now = new Date() } = {}) => {
  const settings = await getAuctionSettings();
  await assertWithinLimit({
    key: `bid:${groupId}:${sellerId}`,
    limit: 1,
    windowMs: settings.bidCooldownSeconds * 1000,
    message: 'Please wait a few seconds between bids.',
    code: 'BID_TOO_FAST',
  });

  const [group, dealer, seller] = await Promise.all([
    Group.findById(groupId).lean(),
    AuctionDealer.findOne({ groupId, sellerId }).lean(),
    Seller.findById(sellerId)
      .select('kyc status cities categories rating ratingCount penalties')
      .lean(),
  ]);
  if (!group) throw ApiError.notFound('Auction not found');
  const auction = group.auction || {};
  if (
    group.status !== GROUP_STATUS.AUCTION_LIVE ||
    auction.closedAt ||
    !auction.endsAt ||
    new Date(auction.endsAt) <= now
  ) {
    throw ApiError.conflict('This auction is closed', { code: 'AUCTION_CLOSED' });
  }
  if (auction.pausedAt)
    throw ApiError.conflict('This auction is paused by SaathMein', { code: 'AUCTION_PAUSED' });
  if (!dealer || dealer.status === 'backed_out') {
    throw new ApiError(403, 'Join the auction and accept the commitment first', {
      code: 'NOT_JOINED',
    });
  }
  const reason = ineligibilityReason(seller, group, settings, now);
  if (reason) throw new ApiError(403, 'Your business cannot bid in this auction', { code: reason });

  const price = input.pricePerUnitPaise;
  if (breakdownTotal(input.breakdown) !== price) {
    throw new ApiError(422, 'The breakdown must add up to the all-inclusive price', {
      code: 'BREAKDOWN_MISMATCH',
      details: { breakdownTotalPaise: breakdownTotal(input.breakdown), pricePerUnitPaise: price },
    });
  }
  const { maxPaise } = maxAllowedBid(auction);
  if (maxPaise !== null && price > maxPaise) {
    const first = !auction.lowestPricePaise;
    throw ApiError.conflict(
      first
        ? `Your first price must be below the current market price ${formatINR(auction.ceilingPricePaise)}`
        : `Bid must be at most ${formatINR(maxPaise)} (beat the lowest by the minimum step)`,
      { code: first ? 'ABOVE_CEILING' : 'BID_TOO_HIGH', details: { maxAllowedPaise: maxPaise } },
    );
  }

  // Anti-sniping (category rules)
  const rules = await auctionRulesFor(group.categoryId);
  const endsAt = new Date(auction.endsAt);
  const inLastMinutes = endsAt.getTime() - now.getTime() <= rules.antiSnipeMinutes * MINUTE_MS;
  const extended = inLastMinutes && (auction.extensions || 0) < rules.maxExtensions;
  const newEndsAt = extended
    ? new Date(endsAt.getTime() + rules.antiSnipeMinutes * MINUTE_MS)
    : endsAt;
  const isFirstBidOfDealer = !dealer.firstBidAt;
  const previousLeaderBid = auction.lowestBidId
    ? await Bid.findById(auction.lowestBidId).select('sellerId').lean()
    : null;

  const result = await withTransaction(async (session) => {
    const [bid] = await Bid.create(
      [
        {
          groupId,
          sellerId,
          placedBy: userId,
          pricePerUnitPaise: price,
          breakdown: input.breakdown,
          inclusions: input.inclusions,
          terms: input.terms,
          deliveryBy: dealer.deliveryBy,
          validTill: new Date(now.getTime() + dealer.priceValidityDays * DAY_MS),
          ip,
        },
      ],
      { session },
    );
    // Compare-and-set: only if the lowest bid and end time are still what we checked
    const updated = await Group.findOneAndUpdate(
      {
        _id: groupId,
        status: GROUP_STATUS.AUCTION_LIVE,
        'auction.lowestBidId': auction.lowestBidId ?? null,
        'auction.endsAt': auction.endsAt,
      },
      {
        $set: {
          'auction.lowestBidId': bid._id,
          'auction.lowestPricePaise': price,
          ...(extended ? { 'auction.endsAt': newEndsAt } : {}),
        },
        $inc: {
          'auction.bidCount': 1,
          ...(isFirstBidOfDealer ? { 'auction.dealerCount': 1 } : {}),
          ...(extended ? { 'auction.extensions': 1 } : {}),
        },
      },
      { new: true, session },
    );
    if (!updated) {
      throw ApiError.conflict(
        'Another dealer just bid. Check the new lowest price and try again.',
        {
          code: 'BID_RACE',
        },
      );
    }
    await AuctionDealer.updateOne(
      { groupId, sellerId },
      {
        $set: {
          status: 'leading',
          bestPricePaise: price,
          ...(isFirstBidOfDealer ? { firstBidAt: now } : {}),
        },
        $inc: { bidCount: 1 },
      },
      { session },
    );
    if (auction.lowestBidId) {
      await Bid.updateOne(
        { _id: auction.lowestBidId },
        { $set: { status: BID_STATUS.OUTBID } },
        { session },
      );
    }
    if (previousLeaderBid && String(previousLeaderBid.sellerId) !== String(sellerId)) {
      await AuctionDealer.updateOne(
        { groupId, sellerId: previousLeaderBid.sellerId },
        { $set: { status: 'outbid' } },
        { session },
      );
    }
    return { bid, group: updated };
  });

  await afterBid(result.group, { sellerId, previousLeaderBid, extended, now, settings });
  log.info({ groupId, sellerId, price, extended }, 'Bid placed');
  return {
    bid: { id: String(result.bid._id), pricePerUnitPaise: price, createdAt: result.bid.createdAt },
    rank: 1,
    lowestPricePaise: price,
    endsAt: result.group.auction.endsAt,
    extended,
  };
};

/**
 * After a bid is saved: live updates, ranks, outbid notice, buyer price alert (throttled),
 * re-schedule the close when extended. Never throws.
 */
const afterBid = async (group, { sellerId, previousLeaderBid, extended, now, settings }) => {
  try {
    const numbers = auctionNumbers(group);
    emitToAuction(group._id, SOCKET_EVENTS.AUCTION_LOWEST, numbers);
    if (extended) {
      emitToAuction(group._id, SOCKET_EVENTS.AUCTION_EXTENDED, {
        endsAt: numbers.endsAt,
        extensions: numbers.extensions,
      });
      await scheduleAuctionClose(group);
    }

    // Each joined dealer learns only their own rank (AUC-6)
    const dealers = await AuctionDealer.find({ groupId: group._id }).lean();
    for (const dealer of dealers) {
      emitToSeller(dealer.sellerId, SOCKET_EVENTS.AUCTION_RANK, {
        groupId: String(group._id),
        rank: rankOf(dealers, dealer.sellerId),
        myBestPricePaise: dealer.bestPricePaise ?? null,
        lowestPricePaise: numbers.lowestPricePaise,
      });
    }

    const productName = await productNameOf(group);
    const price = formatINR(numbers.lowestPricePaise);
    if (previousLeaderBid && String(previousLeaderBid.sellerId) !== String(sellerId)) {
      await notifyDealer(
        previousLeaderBid.sellerId,
        NOTIFICATION_TYPE.DEALER_OUTBID,
        { productName, price, url: `/auctions/${group._id}` },
        (business) =>
          emailService.sendOutbid({
            to: business.contactEmail,
            productName,
            lowestPrice: price,
            url: dealerAuctionUrl(group._id),
          }),
      );
    }

    // Buyers: "new lowest price" at most once per priceAlertMinutes per group
    const quietUntil = new Date(now.getTime() - settings.priceAlertMinutes * MINUTE_MS);
    const claimed = await Group.updateOne(
      {
        _id: group._id,
        $or: [
          { 'auction.lastPriceAlertAt': { $exists: false } },
          { 'auction.lastPriceAlertAt': { $lte: quietUntil } },
        ],
      },
      { $set: { 'auction.lastPriceAlertAt': now } },
    );
    if (claimed.modifiedCount) {
      await notifyGroupMembers(group, NOTIFICATION_TYPE.NEW_LOWEST_PRICE, {
        price,
        saved: numbers.savedPerMemberPaise ? formatINR(numbers.savedPerMemberPaise) : formatINR(0),
      });
    }
  } catch (err) {
    log.warn({ err: err.message, groupId: String(group._id) }, 'After-bid updates failed');
  }
};

module.exports = { breakdownTotal, maxAllowedBid, placeBid };
