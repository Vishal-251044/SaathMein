/**
 * Live auctions (PRD §10.5, AUC-1 to AUC-9):
 * - startAuction: a full buyer-led group goes live at once with the category's rules
 *   (duration, minimum step, anti-sniping) and a starting ceiling from the catalog.
 * - notifyEligibleDealers: every eligible dealer gets an email and an in-app notice.
 * - joinAuction: a dealer accepts the commitment (honour the price for every member,
 *   deliver by a date, keep the price valid 7–15 days) before bidding.
 * - Buyer view (falling price, dealers bidding, time left, saved so far; winner after close)
 *   and dealer views (live / upcoming / won lists, auction detail with my rank) — dealers
 *   never see other dealers' names or prices except the current lowest (AUC-6).
 * - Single-dealer result: the leader accepts that price or cancels with full refunds.
 */
const Group = require('../../models/group.model');
const GroupMember = require('../../models/groupMember.model');
const Bid = require('../../models/bid.model');
const Seller = require('../../models/seller.model');
const SellerStaff = require('../../models/sellerStaff.model');
const AuctionDealer = require('../../models/auctionDealer.model');
const Category = require('../../models/category.model');
const City = require('../../models/city.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { getPagination, buildPaginationMeta } = require('../../helpers/genericFunctions');
const { transition } = require('../groups/stateMachine');
const { notifyUsers } = require('../notifications/notification.service');
const { getAuctionSettings } = require('../settings.service');
const { toPublicSeller } = require('../seller/sellerPresenter');
const { toProductCard } = require('../catalog/productPresenter');
const emailService = require('../email.service');
const {
  auctionCeilingPaise,
  findEligibleSellers,
  businessIneligibility,
  ineligibilityReason,
} = require('./eligibility');
const { phoneForDealer } = require('../trust/privacy');
const { declareWinner, dealerAuctionUrl, productNameOf } = require('./winner.service');
const {
  GROUP_STATUS,
  GROUP_TYPE,
  GROUP_VISIBILITY,
  MEMBER_STATUS,
  NOTIFICATION_TYPE,
} = require('../../constants/enums');

const log = createLogger('AuctionService');
const HOUR_MS = 60 * 60 * 1000;
const PRODUCT_FIELDS = 'brand model slug categoryId images variants priceByCity';

/** Auction rules of a group's category (with PRD defaults). */
const auctionRulesFor = async (categoryId) => {
  const category = await Category.findById(categoryId).select('rules.auction').lean();
  return {
    durationHours: 24,
    minStepPaise: 20_000,
    minStepBps: 25,
    antiSnipeMinutes: 5,
    maxExtensions: 6,
    minDealers: 2,
    ...(category?.rules?.auction || {}),
  };
};

/**
 * Start the live auction of a buyer-led group: when it is full (group effects) or when the
 * leader starts early at ≥70% (same rules and ceiling — open question 5).
 * @param {Object} group - Group in `full` (or `open` for an early start)
 * @param {{ reason?: string, actor?: Object, ctx?: Object, unset?: Object, rethrow?: boolean }} [options]
 * @returns {Promise<Object|null>} Updated group, or null when it could not start
 */
const startAuction = async (
  group,
  { reason = 'group_full', actor, ctx, unset, rethrow = false } = {},
) => {
  try {
    const rules = await auctionRulesFor(group.categoryId);
    const ceiling = await auctionCeilingPaise(group);
    if (!ceiling)
      log.warn(
        { groupId: String(group._id) },
        'No catalog price for this city: auction has no ceiling',
      );
    const startsAt = new Date();
    return await transition(group, GROUP_STATUS.AUCTION_LIVE, {
      reason,
      actor,
      ctx,
      unset,
      set: {
        'auction.startsAt': startsAt,
        'auction.endsAt': new Date(startsAt.getTime() + rules.durationHours * HOUR_MS),
        'auction.extensions': 0,
        'auction.dealerCount': 0,
        'auction.bidCount': 0,
        'auction.ceilingPricePaise': ceiling ?? undefined,
        'auction.minStepPaise': rules.minStepPaise,
        'auction.minStepBps': rules.minStepBps,
      },
    });
  } catch (err) {
    if (rethrow) throw err;
    log.error(
      { err: err.message, groupId: String(group._id) },
      '[AuctionService] could not start the auction',
    );
    return null;
  }
};

/**
 * Tell every eligible dealer that an auction is open (AUC-1): in-app for their team and an
 * email to the business.
 * @param {Object} group - Group in auction_live
 * @returns {Promise<number>} Dealers notified
 */
const notifyEligibleDealers = async (group) => {
  try {
    const settings = await getAuctionSettings();
    const [sellers, productName, city] = await Promise.all([
      findEligibleSellers(group, settings),
      productNameOf(group),
      City.findById(group.cityId).select('name').lean(),
    ]);
    if (!sellers.length) return 0;
    const staff = await SellerStaff.find({
      sellerId: { $in: sellers.map((s) => s._id) },
      status: 'active',
    }).distinct('userId');
    await notifyUsers(staff, NOTIFICATION_TYPE.DEALER_AUCTION_OPEN, {
      productName,
      memberCount: group.memberCount,
      groupId: group._id,
      url: `/auctions/${group._id}`,
    });
    const emails = sellers.map((seller) => seller.contactEmail).filter(Boolean);
    for (const email of emails) {
      await emailService.sendAuctionOpen({
        to: email,
        productName,
        cityName: city?.name || 'your city',
        groupSize: group.memberCount,
        endsAt: new Date(group.auction.endsAt),
        url: dealerAuctionUrl(group._id),
      });
    }
    return sellers.length;
  } catch (err) {
    log.warn({ err: err.message, groupId: String(group._id) }, 'Dealer notification failed');
    return 0;
  }
};

/** Load a dealer business with what eligibility needs. */
const loadSeller = (sellerId) =>
  Seller.findById(sellerId)
    .select('kyc status cities categories rating ratingCount penalties businessName')
    .lean();

/**
 * Join an auction by accepting the commitment (AUC-2).
 * @param {string} groupId - Group in auction_live
 * @param {{ sellerId: string, userId: string }} dealer - Team member joining for the business
 * @param {{ deliveryBy: string|Date, priceValidityDays: number }} commitment
 * @returns {Promise<Object>} Dealer auction view
 * @throws {ApiError} 403 not eligible, 409 not live, 422 bad delivery date
 */
const joinAuction = async (groupId, { sellerId, userId }, { deliveryBy, priceValidityDays }) => {
  const [group, seller, settings] = await Promise.all([
    Group.findById(groupId).lean(),
    loadSeller(sellerId),
    getAuctionSettings(),
  ]);
  if (!group || group.type !== GROUP_TYPE.BUYER_LED) throw ApiError.notFound('Auction not found');
  if (group.status !== GROUP_STATUS.AUCTION_LIVE || group.auction?.closedAt) {
    throw ApiError.conflict('This auction is not open', { code: 'AUCTION_NOT_LIVE' });
  }
  const reason = ineligibilityReason(seller, group, settings);
  if (reason) throw new ApiError(403, 'Your business cannot bid in this auction', { code: reason });
  const delivery = new Date(deliveryBy);
  if (Number.isNaN(delivery.getTime()) || delivery <= new Date()) {
    throw new ApiError(422, 'Choose a delivery date in the future', {
      code: 'INVALID_DELIVERY_DATE',
    });
  }

  const result = await AuctionDealer.updateOne(
    { groupId, sellerId },
    {
      $setOnInsert: {
        joinedBy: userId,
        joinedAt: new Date(),
        commitmentAccepted: true,
        deliveryBy: delivery,
        priceValidityDays,
        status: 'joined',
      },
    },
    { upsert: true },
  );
  if (result.upsertedCount) {
    await Group.updateOne({ _id: groupId }, { $inc: { 'auction.joinedDealerCount': 1 } });
    log.info({ groupId, sellerId }, 'Dealer joined auction');
    // Suspicious: someone on this dealer's team is also a buyer in the group
    const team = await SellerStaff.find({ sellerId, status: 'active' }).distinct('userId');
    if (
      await GroupMember.exists({
        groupId,
        userId: { $in: team },
        status: { $in: [MEMBER_STATUS.ACTIVE, MEMBER_STATUS.ACCEPTED] },
      })
    ) {
      const { raiseAlert } = require('../alerts/alert.service');
      await raiseAlert({
        type: 'suspicious_bidding',
        severity: 'warning',
        title: 'Dealer team member is also a buyer in the group',
        message:
          'A user on the dealer team joined this group as a buyer. Check before the auction closes.',
        subjectType: 'group',
        subjectId: String(groupId),
        dedupeKey: `bids:linked:${groupId}:${sellerId}`,
      });
    }
  }
  return getSellerAuction(groupId, sellerId);
};

/**
 * This dealer's rank: 1 + dealers with a lower best price (prices must differ by the step).
 * @param {Object[]} dealers - AuctionDealer rows of the group
 * @param {string} sellerId - Dealer
 * @returns {number|null} Rank, or null before the dealer bids
 */
const rankOf = (dealers, sellerId) => {
  const me = dealers.find((dealer) => String(dealer.sellerId) === String(sellerId));
  if (!me?.bestPricePaise) return null;
  return (
    1 +
    dealers.filter((dealer) => dealer.bestPricePaise && dealer.bestPricePaise < me.bestPricePaise)
      .length
  );
};

/** Shared auction numbers (safe for everyone: no dealer names or other prices). */
const auctionNumbers = (group) => {
  const auction = group.auction || {};
  const lowest = auction.lowestPricePaise ?? null;
  const ceiling = auction.ceilingPricePaise ?? null;
  return {
    status: group.status,
    ceilingPaise: ceiling,
    lowestPricePaise: lowest,
    savedPerMemberPaise: ceiling && lowest ? Math.max(0, ceiling - lowest) : null,
    dealerCount: auction.dealerCount || 0,
    joinedDealerCount: auction.joinedDealerCount || 0,
    bidCount: auction.bidCount || 0,
    startsAt: auction.startsAt || null,
    endsAt: auction.endsAt || null,
    extensions: auction.extensions || 0,
    closedAt: auction.closedAt || null,
    paused: Boolean(auction.pausedAt),
  };
};

/**
 * Price history for the chart: every accepted bid was a new lowest price (time, price only).
 * @param {string} groupId - Group
 * @returns {Promise<{ pricePaise: number, at: Date }[]>}
 */
const priceHistory = async (groupId) => {
  const bids = await Bid.find({ groupId })
    .sort({ createdAt: 1 })
    .select('pricePerUnitPaise createdAt')
    .limit(500)
    .lean();
  return bids.map((bid) => ({ pricePaise: bid.pricePerUnitPaise, at: bid.createdAt }));
};

/**
 * Auction for buyers (group page live card, AUC-9).
 * @param {Object} group - Lean group (access already checked by the caller)
 * @param {{ userId?: string }} viewer
 * @returns {Promise<Object|null>} null for groups without an auction
 */
const getBuyerAuction = async (group, { userId } = {}) => {
  if (group.type !== GROUP_TYPE.BUYER_LED || !group.auction?.startsAt) return null;
  const [history, winner] = await Promise.all([
    priceHistory(group._id),
    group.sellerId
      ? Seller.findById(group.sellerId)
          .select('businessName address rating ratingCount reviewCount kyc.status')
          .lean()
      : null,
  ]);
  const isLeader = Boolean(userId && String(group.leaderId) === String(userId));
  return {
    ...auctionNumbers(group),
    history,
    winner: winner
      ? {
          ...toPublicSeller(winner),
          address: winner.address || null,
          pricePaise: group.winningPricePaise,
        }
      : null,
    singleBidDecision:
      group.auction.singleBidDecisionDueAt && group.status === GROUP_STATUS.AUCTION_LIVE
        ? {
            dueAt: group.auction.singleBidDecisionDueAt,
            pricePaise: group.auction.lowestPricePaise,
            canDecide: isLeader,
          }
        : null,
  };
};

/**
 * Auction detail for a dealer (bid screen): shared numbers + my commitment, my best price,
 * my rank, my bids, and whether I may bid.
 * @param {string} groupId - Group
 * @param {string} sellerId - Dealer
 * @returns {Promise<Object>}
 */
const getSellerAuction = async (groupId, sellerId) => {
  const group = await Group.findById(groupId).populate('productId', PRODUCT_FIELDS).lean();
  if (!group || group.type !== GROUP_TYPE.BUYER_LED) throw ApiError.notFound('Auction not found');
  const [seller, settings, dealers, myBids, city] = await Promise.all([
    loadSeller(sellerId),
    getAuctionSettings(),
    AuctionDealer.find({ groupId }).lean(),
    Bid.find({ groupId, sellerId }).sort({ createdAt: -1 }).limit(50).lean(),
    City.findById(group.cityId).select('name').lean(),
  ]);
  const me = dealers.find((dealer) => String(dealer.sellerId) === String(sellerId));
  const eligibility = ineligibilityReason(seller, group, settings);
  const isWinner = group.sellerId && String(group.sellerId) === String(sellerId);
  const runnerUpBid = group.auction?.runnerUpBidId
    ? myBids.find((bid) => String(bid._id) === String(group.auction.runnerUpBidId))
    : null;

  // Members (first names) and deal codes only for the winning dealer (Day 10 confirms)
  const members = isWinner
    ? (
        await GroupMember.find({ groupId, status: MEMBER_STATUS.ACTIVE })
          .populate('userId', 'name phone')
          .select('userId dealCode joinedAt')
          .lean()
      ).map((member) => ({
        firstName: member.userId?.name?.trim().split(/\s+/)[0] || null,
        dealCode: member.dealCode || null,
        // Masked until the member can no longer leave (decided 12 Nov 2026)
        ...phoneForDealer(member.userId?.phone, group.exitWindowEndsAt),
      }))
    : [];

  return {
    groupId: String(group._id),
    product: group.productId ? toProductCard(group.productId, String(group.cityId)) : null,
    variantKey: group.variantKey || null,
    variantName:
      group.productId?.variants?.find((variant) => variant.key === group.variantKey)?.name || null,
    cityName: city?.name || null,
    memberCount: group.memberCount,
    ...auctionNumbers(group),
    minStepPaise: group.auction?.minStepPaise ?? null,
    minStepBps: group.auction?.minStepBps ?? null,
    eligible: !eligibility,
    ineligibleReason: eligibility,
    joined: Boolean(me),
    commitment: me ? { deliveryBy: me.deliveryBy, priceValidityDays: me.priceValidityDays } : null,
    myBestPricePaise: me?.bestPricePaise ?? null,
    myRank: rankOf(dealers, sellerId),
    myStatus: me?.status || null,
    myBids: myBids.map((bid) => ({
      id: String(bid._id),
      pricePerUnitPaise: bid.pricePerUnitPaise,
      status: bid.status,
      createdAt: bid.createdAt,
    })),
    isWinner: Boolean(isWinner),
    runnerUpOffer:
      group.status === GROUP_STATUS.RUNNER_UP && runnerUpBid
        ? { dueAt: group.auction.runnerUpOfferDueAt, pricePaise: runnerUpBid.pricePerUnitPaise }
        : null,
    exitWindowEndsAt: isWinner ? group.exitWindowEndsAt || null : null,
    members,
  };
};

/** Dealer list card. */
const toDealerCard = (group, dealer, cityNames) => ({
  groupId: String(group._id),
  product: group.productId?._id ? toProductCard(group.productId, String(group.cityId)) : null,
  variantName:
    group.productId?.variants?.find((variant) => variant.key === group.variantKey)?.name || null,
  cityName: cityNames.get(String(group.cityId)) || null,
  status: group.status,
  memberCount: group.memberCount,
  targetSize: group.targetSize,
  deadline: group.deadline,
  ...auctionNumbers(group),
  joined: Boolean(dealer),
  myBestPricePaise: dealer?.bestPricePaise ?? null,
  isWinner: Boolean(dealer && String(group.sellerId) === String(dealer.sellerId)),
  winningPricePaise: group.winningPricePaise ?? null,
});

/**
 * Dealer dashboard lists (AUC-1):
 * - live: auctions the dealer may bid in (or already joined)
 * - upcoming: open buyer-led groups in the dealer's coverage, still filling
 * - won: groups this dealer won
 * @param {string} sellerId - Dealer
 * @param {{ tab: 'live'|'upcoming'|'won', page?: string, limit?: string }} query
 * @returns {Promise<{ groups: Object[], meta: Object }>}
 */
const listSellerAuctions = async (sellerId, { tab = 'live', ...query }) => {
  const pagination = getPagination(query);
  const [seller, settings] = await Promise.all([loadSeller(sellerId), getAuctionSettings()]);
  if (!seller) throw ApiError.notFound('Dealer not found');

  let filter;
  if (tab === 'won') {
    filter = {
      sellerId,
      type: GROUP_TYPE.BUYER_LED,
      status: { $in: [GROUP_STATUS.WON, GROUP_STATUS.PURCHASING, GROUP_STATUS.COMPLETED] },
    };
  } else {
    const coverage = {
      cityId: { $in: seller.cities || [] },
      categoryId: { $in: seller.categories || [] },
      type: GROUP_TYPE.BUYER_LED,
    };
    filter =
      tab === 'upcoming'
        ? {
            ...coverage,
            status: { $in: [GROUP_STATUS.OPEN, GROUP_STATUS.FULL] },
            visibility: GROUP_VISIBILITY.PUBLIC,
          }
        : { ...coverage, status: { $in: [GROUP_STATUS.AUCTION_LIVE, GROUP_STATUS.RUNNER_UP] } };
    // Live auctions only for dealers who may bid (upcoming groups are shown to every covering dealer)
    if (tab === 'live' && businessIneligibility(seller, settings)) {
      return { groups: [], meta: buildPaginationMeta(0, pagination) };
    }
  }
  const sort =
    tab === 'live'
      ? { 'auction.endsAt': 1 }
      : tab === 'upcoming'
        ? { memberCount: -1 }
        : { updatedAt: -1 };
  const [groups, total] = await Promise.all([
    Group.find(filter)
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('productId', PRODUCT_FIELDS)
      .lean(),
    Group.countDocuments(filter),
  ]);
  const [dealers, cities] = await Promise.all([
    AuctionDealer.find({ sellerId, groupId: { $in: groups.map((g) => g._id) } }).lean(),
    City.find({ _id: { $in: [...new Set(groups.map((g) => String(g.cityId)))] } })
      .select('name')
      .lean(),
  ]);
  const bySeller = new Map(dealers.map((dealer) => [String(dealer.groupId), dealer]));
  const cityNames = new Map(cities.map((city) => [String(city._id), city.name]));
  return {
    groups: groups.map((group) => toDealerCard(group, bySeller.get(String(group._id)), cityNames)),
    meta: buildPaginationMeta(total, pagination),
  };
};

/**
 * Leader's answer when only one dealer bid (decided 8 Nov 2026: 24 h, else cancel).
 * @param {string} groupId - Group in auction_live waiting for the leader
 * @param {string} userId - Leader
 * @param {boolean} accept - Accept the single price
 * @returns {Promise<Object>} Updated group
 */
const decideSingleBid = async (groupId, userId, accept) => {
  const group = await Group.findById(groupId);
  if (!group) throw ApiError.notFound('Group not found');
  if (String(group.leaderId) !== String(userId))
    throw ApiError.forbidden('Only the group leader can decide');
  if (group.status !== GROUP_STATUS.AUCTION_LIVE || !group.auction?.singleBidDecisionDueAt) {
    throw ApiError.conflict('There is nothing to decide right now', {
      code: 'NO_DECISION_PENDING',
    });
  }
  const actor = { type: 'user', id: userId };
  if (!accept) {
    return transition(group, GROUP_STATUS.CANCELLED, { reason: 'single_bid_declined', actor });
  }
  const bid = await Bid.findById(group.auction.lowestBidId).lean();
  if (!bid)
    throw ApiError.conflict('The offer is no longer available', { code: 'NO_DECISION_PENDING' });
  return declareWinner(group, bid, null, { reason: 'leader_accepted_single_bid', actor });
};

module.exports = {
  auctionRulesFor,
  startAuction,
  notifyEligibleDealers,
  joinAuction,
  rankOf,
  auctionNumbers,
  getBuyerAuction,
  getSellerAuction,
  listSellerAuctions,
  decideSingleBid,
};
