/**
 * Owner console monitors (PRD §10.11 Live monitoring, MON-1): platform overview, groups,
 * auctions (with dealer names and the full bid timeline — staff only), dealers, buyers,
 * disputes SLA and system health. Every list can be filtered by city, category and dates.
 * The console refreshes on `monitor:changed` socket nudges and every 30 s.
 * Payments have their own monitor (paymentMonitor.service.js).
 */
const mongoose = require('mongoose');
const Alert = require('../../models/alert.model');
const AuctionDealer = require('../../models/auctionDealer.model');
const Bid = require('../../models/bid.model');
const Commission = require('../../models/commission.model');
const Dispute = require('../../models/dispute.model');
const Group = require('../../models/group.model');
const GroupMember = require('../../models/groupMember.model');
const Payment = require('../../models/payment.model');
const Purchase = require('../../models/purchase.model');
const Seller = require('../../models/seller.model');
const User = require('../../models/user.model');
const config = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const {
  getPagination,
  buildPaginationMeta,
  firstNameOnly,
} = require('../../helpers/genericFunctions');
const { getHealthReport } = require('../health.service');
const { getSocketStats } = require('../../sockets/emitter');
const { getMetricsSnapshot } = require('../../middlewares/metrics.middleware');
const { getQueue, QUEUE_NAMES } = require('../../jobs/queues');
const {
  DISPUTE_STATUS,
  GROUP_STATUS,
  MEMBER_STATUS,
  PAYMENT_STATUS,
  PURCHASE_STATUS,
} = require('../../constants/enums');

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000;
const PRODUCT_FIELDS = 'brand model images';
const isSet = (value) => Boolean(value) && !/^your_.*_here$/.test(value);
const toId = (value) => new mongoose.Types.ObjectId(String(value));

/** Midnight IST of a date (as a UTC instant). */
const istDayStart = (date) => {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS,
  );
};

/** Group filter from the shared monitor filters (city, category). */
const groupScope = ({ cityId, categoryId } = {}) => ({
  ...(cityId ? { cityId: toId(cityId) } : {}),
  ...(categoryId ? { categoryId: toId(categoryId) } : {}),
});

/** Group ids for a city / category filter (for collections without those fields). */
const scopedGroupIds = async (filters) => {
  const scope = groupScope(filters);
  if (!Object.keys(scope).length) return null;
  return Group.find(scope).distinct('_id');
};

/* --------------------------------- Overview --------------------------------- */

/**
 * Platform overview (live numbers + today vs the last 7 days).
 * @param {{ cityId?: string, categoryId?: string }} filters
 * @param {Date} [now]
 */
const getOverview = async (filters = {}, now = new Date()) => {
  const scope = groupScope(filters);
  const ids = await scopedGroupIds(filters);
  const inGroups = ids ? { groupId: { $in: ids } } : {};
  const today = istDayStart(now);
  const weekAgo = new Date(today.getTime() - 6 * DAY_MS);

  const [
    groupsFilling,
    auctionsLive,
    purchasesToday,
    salesToday,
    commissionToday,
    held,
    refundsToday,
    openDisputes,
    openAlerts,
    daily,
  ] = await Promise.all([
    Group.countDocuments({ ...scope, status: GROUP_STATUS.OPEN }),
    Group.countDocuments({ ...scope, status: GROUP_STATUS.AUCTION_LIVE }),
    Purchase.countDocuments({
      ...inGroups,
      status: PURCHASE_STATUS.COMPLETED,
      completedAt: { $gte: today },
    }),
    Purchase.aggregate([
      { $match: { ...inGroups, status: PURCHASE_STATUS.COMPLETED, completedAt: { $gte: today } } },
      { $group: { _id: null, gmvPaise: { $sum: '$pricePaise' } } },
    ]),
    Commission.aggregate([
      { $match: { ...inGroups, earnedAt: { $gte: today } } },
      { $group: { _id: null, commissionPaise: { $sum: '$commissionPaise' } } },
    ]),
    Payment.aggregate([
      {
        $match: {
          ...inGroups,
          status: { $in: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.TRANSFERRED] },
          'transfer.status': { $ne: 'released' },
        },
      },
      { $group: { _id: null, paise: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: inGroups },
      { $unwind: '$refunds' },
      { $match: { 'refunds.createdAt': { $gte: today } } },
      { $group: { _id: null, paise: { $sum: '$refunds.amountPaise' }, count: { $sum: 1 } } },
    ]),
    Dispute.countDocuments({ ...inGroups, status: { $ne: DISPUTE_STATUS.RESOLVED } }),
    Alert.countDocuments({ status: 'open' }),
    Purchase.aggregate([
      {
        $match: { ...inGroups, status: PURCHASE_STATUS.COMPLETED, completedAt: { $gte: weekAgo } },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt', timezone: '+05:30' } },
          purchases: { $sum: 1 },
          gmvPaise: { $sum: '$pricePaise' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  // Savings delivered: market price − winning price over completed purchases this week
  const savings = await Purchase.aggregate([
    { $match: { ...inGroups, status: PURCHASE_STATUS.COMPLETED, completedAt: { $gte: weekAgo } } },
    { $lookup: { from: 'groups', localField: 'groupId', foreignField: '_id', as: 'group' } },
    { $unwind: '$group' },
    {
      $project: {
        saved: {
          $max: [
            0,
            {
              $subtract: [
                {
                  $ifNull: [
                    '$group.auction.ceilingPricePaise',
                    { $ifNull: ['$group.basePricePaise', '$pricePaise'] },
                  ],
                },
                '$pricePaise',
              ],
            },
          ],
        },
      },
    },
    { $group: { _id: null, paise: { $sum: '$saved' } } },
  ]);

  const days = [];
  for (let index = 6; index >= 0; index -= 1) {
    const key = new Date(today.getTime() - index * DAY_MS + IST_OFFSET_MS)
      .toISOString()
      .slice(0, 10);
    const row = daily.find((item) => item._id === key);
    days.push({ day: key, purchases: row?.purchases || 0, gmvPaise: row?.gmvPaise || 0 });
  }

  return {
    activeConnections: getSocketStats().connections,
    groupsFilling,
    auctionsLive,
    purchasesToday,
    gmvTodayPaise: salesToday[0]?.gmvPaise || 0,
    commissionTodayPaise: commissionToday[0]?.commissionPaise || 0,
    tokensHeldPaise: held[0]?.paise || 0,
    tokensHeldCount: held[0]?.count || 0,
    refundsTodayPaise: refundsToday[0]?.paise || 0,
    refundsTodayCount: refundsToday[0]?.count || 0,
    savingsWeekPaise: savings[0]?.paise || 0,
    openDisputes,
    openAlerts,
    aiCostTodayPaise: 0, // AI starts on Day 15
    last7Days: days,
  };
};

/* ---------------------------------- Groups ---------------------------------- */

/**
 * Groups monitor summary: counts by status, stuck near target, expiring in 24 h.
 * @param {Object} filters
 * @param {Date} [now]
 */
const getGroupsMonitor = async (filters = {}, now = new Date()) => {
  const scope = groupScope(filters);
  const soon = new Date(now.getTime() + DAY_MS);
  const [byStatus, nearTarget, expiring, community] = await Promise.all([
    Group.aggregate([{ $match: scope }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Group.find({
      ...scope,
      status: GROUP_STATUS.OPEN,
      deadline: { $lte: soon },
      $expr: { $gte: ['$memberCount', { $multiply: ['$targetSize', 0.8] }] },
    })
      .sort({ deadline: 1 })
      .limit(20)
      .populate('productId', PRODUCT_FIELDS)
      .lean(),
    Group.find({ ...scope, status: GROUP_STATUS.OPEN, deadline: { $gt: now, $lte: soon } })
      .sort({ deadline: 1 })
      .limit(20)
      .populate('productId', PRODUCT_FIELDS)
      .lean(),
    Group.countDocuments({
      ...scope,
      visibility: 'community',
      status: { $in: [GROUP_STATUS.OPEN, GROUP_STATUS.FULL] },
    }),
  ]);
  const row = (group) => ({
    id: String(group._id),
    productName: group.productId?.brand
      ? `${group.productId.brand} ${group.productId.model}`
      : null,
    memberCount: group.memberCount,
    targetSize: group.targetSize,
    deadline: group.deadline,
    visibility: group.visibility,
  });
  return {
    byStatus: Object.fromEntries(byStatus.map((item) => [item._id, item.count])),
    nearTarget: nearTarget.map(row),
    expiring24h: expiring.map(row),
    communityActive: community,
  };
};

/* --------------------------------- Auctions --------------------------------- */

/** Price drop from the ceiling, in basis points. */
const dropBps = (auction) =>
  auction?.ceilingPricePaise && auction?.lowestPricePaise
    ? Math.round(
        ((auction.ceilingPricePaise - auction.lowestPricePaise) / auction.ceilingPricePaise) *
          10_000,
      )
    : null;

/**
 * Every live (or recent) auction with its numbers (staff only).
 * @param {{ cityId?: string, categoryId?: string, status?: string, page?: string, limit?: string }} query
 */
const listAuctions = async ({ status = 'live', ...query } = {}) => {
  const pagination = getPagination(query);
  const statuses =
    status === 'live'
      ? [GROUP_STATUS.AUCTION_LIVE]
      : [GROUP_STATUS.WON, GROUP_STATUS.RUNNER_UP, GROUP_STATUS.PURCHASING, GROUP_STATUS.NO_DEAL];
  const filter = {
    ...groupScope(query),
    type: 'buyer_led',
    status: { $in: statuses },
    'auction.startsAt': { $exists: true },
  };
  const [rows, total] = await Promise.all([
    Group.find(filter)
      .sort(status === 'live' ? { 'auction.endsAt': 1 } : { updatedAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('productId', PRODUCT_FIELDS)
      .populate('cityId', 'name')
      .lean(),
    Group.countDocuments(filter),
  ]);
  return {
    auctions: rows.map((group) => ({
      groupId: String(group._id),
      productName: group.productId?.brand
        ? `${group.productId.brand} ${group.productId.model}`
        : null,
      cityName: group.cityId?.name || null,
      status: group.status,
      memberCount: group.memberCount,
      dealersJoined: group.auction?.joinedDealerCount || 0,
      dealersBidding: group.auction?.dealerCount || 0,
      bidCount: group.auction?.bidCount || 0,
      ceilingPaise: group.auction?.ceilingPricePaise ?? null,
      lowestPricePaise: group.auction?.lowestPricePaise ?? null,
      dropBps: dropBps(group.auction),
      endsAt: group.auction?.endsAt || null,
      extensions: group.auction?.extensions || 0,
      paused: Boolean(group.auction?.pausedAt),
      closedAt: group.auction?.closedAt || null,
    })),
    meta: buildPaginationMeta(total, pagination),
  };
};

/**
 * One auction with the full bid timeline and dealer names (staff only, AUC-6 hides them
 * from buyers and other dealers).
 * @param {string} groupId
 */
const getAuctionDetail = async (groupId) => {
  const group = await Group.findById(groupId)
    .populate('productId', PRODUCT_FIELDS)
    .populate('cityId', 'name')
    .lean();
  if (!group || !group.auction?.startsAt) throw ApiError.notFound('Auction not found');
  const [bids, dealers] = await Promise.all([
    Bid.find({ groupId })
      .sort({ createdAt: 1 })
      .limit(1000)
      .populate('sellerId', 'businessName')
      .lean(),
    AuctionDealer.find({ groupId }).populate('sellerId', 'businessName rating ratingCount').lean(),
  ]);
  return {
    groupId: String(group._id),
    productName: group.productId?.brand
      ? `${group.productId.brand} ${group.productId.model}`
      : null,
    cityName: group.cityId?.name || null,
    status: group.status,
    memberCount: group.memberCount,
    auction: {
      startsAt: group.auction.startsAt,
      endsAt: group.auction.endsAt,
      ceilingPaise: group.auction.ceilingPricePaise ?? null,
      lowestPricePaise: group.auction.lowestPricePaise ?? null,
      dropBps: dropBps(group.auction),
      extensions: group.auction.extensions || 0,
      paused: Boolean(group.auction.pausedAt),
      pausedAt: group.auction.pausedAt || null,
      closedAt: group.auction.closedAt || null,
      winnerBidId: group.auction.winnerBidId ? String(group.auction.winnerBidId) : null,
      runnerUpBidId: group.auction.runnerUpBidId ? String(group.auction.runnerUpBidId) : null,
    },
    dealers: dealers.map((dealer) => ({
      sellerId: String(dealer.sellerId?._id || dealer.sellerId),
      businessName: dealer.sellerId?.businessName || null,
      status: dealer.status,
      bestPricePaise: dealer.bestPricePaise ?? null,
      bidCount: dealer.bidCount || 0,
      joinedAt: dealer.joinedAt,
    })),
    bids: bids.map((bid) => ({
      id: String(bid._id),
      sellerId: String(bid.sellerId?._id || bid.sellerId),
      businessName: bid.sellerId?.businessName || null,
      pricePerUnitPaise: bid.pricePerUnitPaise,
      status: bid.status,
      ip: bid.ip || null,
      createdAt: bid.createdAt,
    })),
    statusHistory: group.statusHistory || [],
  };
};

/* ------------------------------ Dealers / buyers ----------------------------- */

/**
 * Dealer monitor: auctions joined, wins, win rate, average discount, back-outs, rating.
 * @param {{ cityId?: string, categoryId?: string, page?: string, limit?: string }} query
 */
const listDealers = async ({ cityId, categoryId, ...query } = {}) => {
  const pagination = getPagination(query);
  const filter = {
    'kyc.status': { $exists: true },
    ...(cityId ? { cities: toId(cityId) } : {}),
    ...(categoryId ? { categories: toId(categoryId) } : {}),
  };
  const [sellers, total] = await Promise.all([
    Seller.find(filter)
      .sort({ updatedAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .select('businessName status kyc.status rating ratingCount reviewCount penalties')
      .lean(),
    Seller.countDocuments(filter),
  ]);
  const ids = sellers.map((seller) => seller._id);
  const [joined, won] = await Promise.all([
    AuctionDealer.aggregate([
      { $match: { sellerId: { $in: ids } } },
      { $group: { _id: '$sellerId', count: { $sum: 1 } } },
    ]),
    Group.aggregate([
      {
        $match: {
          sellerId: { $in: ids },
          type: 'buyer_led',
          status: { $in: [GROUP_STATUS.WON, GROUP_STATUS.PURCHASING, GROUP_STATUS.COMPLETED] },
        },
      },
      {
        $group: {
          _id: '$sellerId',
          wins: { $sum: 1 },
          discountBps: {
            $avg: {
              $cond: [
                { $gt: ['$auction.ceilingPricePaise', 0] },
                {
                  $multiply: [
                    {
                      $divide: [
                        { $subtract: ['$auction.ceilingPricePaise', '$winningPricePaise'] },
                        '$auction.ceilingPricePaise',
                      ],
                    },
                    10_000,
                  ],
                },
                null,
              ],
            },
          },
        },
      },
    ]),
  ]);
  const joinedBy = new Map(joined.map((row) => [String(row._id), row.count]));
  const wonBy = new Map(won.map((row) => [String(row._id), row]));
  const now = new Date();
  return {
    dealers: sellers.map((seller) => {
      const id = String(seller._id);
      const auctions = joinedBy.get(id) || 0;
      const wins = wonBy.get(id)?.wins || 0;
      const penalties = seller.penalties || [];
      return {
        id,
        businessName: seller.businessName,
        status: seller.status,
        kycStatus: seller.kyc?.status || null,
        rating: seller.ratingCount ? seller.rating : null,
        reviewCount: seller.reviewCount ?? 0,
        auctionsJoined: auctions,
        wins,
        winRateBps: auctions ? Math.round((wins / auctions) * 10_000) : null,
        avgDiscountBps:
          wonBy.get(id)?.discountBps != null ? Math.round(wonBy.get(id).discountBps) : null,
        backOuts: penalties.filter(
          (penalty) => penalty.type === 'rating_penalty' && penalty.groupId && !penalty.disputeId,
        ).length,
        warnings: penalties.filter((penalty) => penalty.type === 'warning').length,
        suspendedUntil:
          penalties
            .filter(
              (penalty) =>
                penalty.type === 'auction_suspension' &&
                (!penalty.until || new Date(penalty.until) > now) &&
                !penalty.liftedAt,
            )
            .map((penalty) => penalty.until)
            .sort()
            .at(-1) || null,
      };
    }),
    meta: buildPaginationMeta(total, pagination),
  };
};

/**
 * Buyer monitor: sign-ups, activity, joins, exits after a win, referrals; searchable list.
 * @param {{ q?: string, page?: string, limit?: string }} query
 * @param {Date} [now]
 */
const getBuyersMonitor = async ({ q, ...query } = {}, now = new Date()) => {
  const pagination = getPagination(query);
  const today = istDayStart(now);
  const weekAgo = new Date(today.getTime() - 6 * DAY_MS);
  const buyerFilter = { staffRole: { $exists: false }, phone: { $exists: true } };
  const listFilter = {
    ...buyerFilter,
    ...(q
      ? {
          $or: [
            { name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
            { phone: new RegExp(`${q.replace(/\D/g, '')}$`) },
          ],
        }
      : {}),
  };
  const [signupsToday, signupsWeek, activeWeek, joinsWeek, exitsAfterWin, referred, rows, total] =
    await Promise.all([
      User.countDocuments({ ...buyerFilter, createdAt: { $gte: today } }),
      User.countDocuments({ ...buyerFilter, createdAt: { $gte: weekAgo } }),
      User.countDocuments({ ...buyerFilter, lastLoginAt: { $gte: weekAgo } }),
      GroupMember.countDocuments({ joinedAt: { $gte: weekAgo }, paymentId: { $exists: true } }),
      Payment.countDocuments({
        'refunds.reason': 'left_after_win',
        'refunds.createdAt': { $gte: weekAgo },
      }),
      User.countDocuments({ ...buyerFilter, referredBy: { $exists: true } }),
      User.find(listFilter)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .select('name phone status cityId createdAt lastLoginAt walletBalancePaise')
        .lean(),
      User.countDocuments(listFilter),
    ]);
  const ids = rows.map((user) => user._id);
  const groupsJoined = await GroupMember.aggregate([
    { $match: { userId: { $in: ids }, paymentId: { $exists: true } } },
    {
      $group: {
        _id: '$userId',
        count: { $sum: 1 },
        left: {
          $sum: {
            $cond: [{ $in: ['$status', [MEMBER_STATUS.LEFT, MEMBER_STATUS.REFUNDED]] }, 1, 0],
          },
        },
      },
    },
  ]);
  const byUser = new Map(groupsJoined.map((row) => [String(row._id), row]));
  return {
    stats: {
      signupsToday,
      signupsWeek,
      activeWeek,
      joinsWeek,
      exitsAfterWinWeek: exitsAfterWin,
      referredUsers: referred,
    },
    buyers: rows.map((user) => ({
      id: String(user._id),
      firstName: firstNameOnly(user.name) || null,
      // Staff see the full number (masked in lists elsewhere); used for Support contact
      phone: user.phone,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt || null,
      groupsJoined: byUser.get(String(user._id))?.count || 0,
      groupsLeft: byUser.get(String(user._id))?.left || 0,
      walletBalancePaise: user.walletBalancePaise || 0,
    })),
    meta: buildPaginationMeta(total, pagination),
  };
};

/* ------------------------------ Disputes / system ---------------------------- */

/**
 * Disputes SLA: open disputes by age, dealer deadlines, decided this week.
 * @param {Date} [now]
 */
const getDisputesMonitor = async (now = new Date()) => {
  const open = await Dispute.find({ status: { $ne: DISPUTE_STATUS.RESOLVED } })
    .select('status createdAt sellerDueAt')
    .lean();
  const age = (dispute) => (now.getTime() - new Date(dispute.createdAt).getTime()) / DAY_MS;
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const decided = await Dispute.aggregate([
    { $match: { status: DISPUTE_STATUS.RESOLVED, 'decision.at': { $gte: weekAgo } } },
    { $group: { _id: '$decision.outcome', count: { $sum: 1 } } },
  ]);
  return {
    open: open.length,
    byAge: {
      under1d: open.filter((d) => age(d) < 1).length,
      d1to3: open.filter((d) => age(d) >= 1 && age(d) < 3).length,
      over3d: open.filter((d) => age(d) >= 3).length,
    },
    dealerMissed: open.filter((d) => d.status === DISPUTE_STATUS.SELLER_MISSED).length,
    dealerDueNext24h: open.filter(
      (d) =>
        d.status === DISPUTE_STATUS.AWAITING_SELLER &&
        d.sellerDueAt &&
        new Date(d.sellerDueAt) - now < DAY_MS,
    ).length,
    decidedWeek: Object.fromEntries(decided.map((row) => [row._id, row.count])),
  };
};

/**
 * System health: API errors and response times (this API process), sockets, job queues,
 * MongoDB / Redis, Razorpay / Firebase configuration, AI cost.
 */
const getSystemHealth = async () => {
  const queues = [];
  for (const name of Object.values(QUEUE_NAMES)) {
    const queue = getQueue(name);
    if (!queue) {
      queues.push({ name, available: false });
      continue;
    }
    try {
      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'failed',
        'completed',
      );
      queues.push({ name, available: true, ...counts });
    } catch (err) {
      queues.push({ name, available: false, error: err.message });
    }
  }
  return {
    health: getHealthReport(),
    api: getMetricsSnapshot(),
    sockets: getSocketStats(),
    queues,
    // Configured with real values (placeholders look like your_..._here)
    services: {
      razorpay: isSet(config.razorpay.keyId),
      firebase: isSet(config.firebase.projectId),
    },
    aiCostTodayPaise: 0,
  };
};

/**
 * Retry the failed jobs of one queue ("retry failed jobs" action).
 * @param {string} name - Queue name
 * @returns {Promise<number>} Jobs retried
 */
const retryFailedJobs = async (name) => {
  if (!Object.values(QUEUE_NAMES).includes(name)) throw ApiError.notFound('Unknown queue');
  const queue = getQueue(name);
  if (!queue) throw new ApiError(503, 'Job queues need Redis', { code: 'QUEUES_UNAVAILABLE' });
  const failed = await queue.getFailed(0, 199);
  await Promise.all(failed.map((job) => job.retry()));
  return failed.length;
};

module.exports = {
  istDayStart,
  dropBps,
  getOverview,
  getGroupsMonitor,
  listAuctions,
  getAuctionDetail,
  listDealers,
  getBuyersMonitor,
  getDisputesMonitor,
  getSystemHealth,
  retryFailedJobs,
};
