/**
 * Seller-led group deals (AUC-9): a verified dealer publishes 2–4 tiers (members →
 * discount); the price drops for everyone when a tier is reached; no auction.
 * - Full (top tier reached) → won at the top tier price.
 * - Deadline with at least the first tier → won at the tier reached.
 * - Deadline below the first tier → expired, every token refunded (open question 4,
 *   decided 8 Nov 2026).
 * Won deals get the same 24 h exit window and deal codes as auctions.
 */
const Group = require('../../models/group.model');
const Product = require('../../models/product.model');
const Category = require('../../models/category.model');
const Seller = require('../../models/seller.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { formatINR, percentOfPaise } = require('../../utils/money');
const {
  generateCode,
  getPagination,
  buildPaginationMeta,
} = require('../../helpers/genericFunctions');
const { transition } = require('../groups/stateMachine');
const { notifyGroupMembers } = require('../groups/groupLive');
const { getAuctionSettings } = require('../settings.service');
const { emitToGroup } = require('../../sockets/emitter');
const { ineligibilityReason } = require('../auction/eligibility');
const { issueDealCodes } = require('../auction/dealCode.service');
const { toProductCard } = require('../catalog/productPresenter');
const {
  GROUP_STATUS,
  GROUP_TYPE,
  GROUP_VISIBILITY,
  NOTIFICATION_TYPE,
  SOCKET_EVENTS,
} = require('../../constants/enums');

const log = createLogger('DealService');
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/* ------------------------------- Pricing ------------------------------- */

/** @param {number} basePaise @param {number} discountBps @returns {number} Price after the discount */
const tierPricePaise = (basePaise, discountBps) =>
  basePaise - percentOfPaise(basePaise, discountBps);

/**
 * Where a deal stands for a member count.
 * @param {{ basePricePaise: number, tiers: { size: number, discountBps: number }[] }} deal
 * @param {number} memberCount
 * @returns {{ currentTier: Object|null, nextTier: Object|null, pricePaise: number, membersToNext: number|null }}
 */
const dealStatus = (deal, memberCount) => {
  const tiers = [...(deal.tiers || [])].sort((a, b) => a.size - b.size);
  const reached = tiers.filter((tier) => memberCount >= tier.size);
  const currentTier = reached.at(-1) || null;
  const nextTier = tiers.find((tier) => memberCount < tier.size) || null;
  const priced = (tier) =>
    tier ? { ...tier, pricePaise: tierPricePaise(deal.basePricePaise, tier.discountBps) } : null;
  return {
    currentTier: priced(currentTier),
    nextTier: priced(nextTier),
    pricePaise: currentTier
      ? tierPricePaise(deal.basePricePaise, currentTier.discountBps)
      : deal.basePricePaise,
    membersToNext: nextTier ? nextTier.size - memberCount : null,
  };
};

/**
 * Check tiers: 2–4, sizes and discounts strictly increasing, within the category's sizes.
 * @param {{ size: number, discountBps: number }[]} tiers
 * @param {{ minSize: number, maxSize: number }} rules - Category rules
 * @throws {ApiError} 422 INVALID_TIERS
 */
const assertValidTiers = (tiers, rules) => {
  const invalid = (message) => new ApiError(422, message, { code: 'INVALID_TIERS' });
  if (tiers.length < 2 || tiers.length > 4) throw invalid('Add 2 to 4 tiers');
  tiers.forEach((tier, index) => {
    if (index === 0) return;
    if (tier.size <= tiers[index - 1].size)
      throw invalid('Each tier needs more people than the one before');
    if (tier.discountBps <= tiers[index - 1].discountBps)
      throw invalid('Each tier needs a bigger discount than the one before');
  });
  if (tiers[0].size < rules.minSize)
    throw invalid(`The first tier needs at least ${rules.minSize} people`);
  if (tiers.at(-1).size > rules.maxSize)
    throw invalid(`A group can have at most ${rules.maxSize} people`);
};

/* ------------------------------- Publishing ------------------------------ */

/**
 * Publish a seller-led deal.
 * @param {{ sellerId: string, userId: string }} dealer - Team member publishing for the business
 * @param {{ productId: string, variantKey?: string|null, cityId: string, basePricePaise: number,
 *   tiers: { size: number, discountBps: number }[], deadlineDays: number, note?: string }} input
 * @returns {Promise<Object>} The deal (dealer view)
 */
const createDeal = async ({ sellerId, userId }, input) => {
  const [seller, product, settings] = await Promise.all([
    Seller.findById(sellerId)
      .select('kyc status cities categories rating ratingCount penalties')
      .lean(),
    Product.findOne({ _id: input.productId, active: true }).lean(),
    getAuctionSettings(),
  ]);
  if (!product) throw ApiError.notFound('This product is not available');
  const category = await Category.findOne({ _id: product.categoryId, active: true }).lean();
  if (!category)
    throw new ApiError(422, 'Groups are not open for this category yet', {
      code: 'CATEGORY_INACTIVE',
    });
  const reason = ineligibilityReason(
    seller,
    { cityId: input.cityId, categoryId: category._id },
    settings,
  );
  if (reason) throw new ApiError(403, 'Your business cannot publish deals here', { code: reason });
  if (input.variantKey && !product.variants?.some((variant) => variant.key === input.variantKey)) {
    throw new ApiError(422, 'Pick a variant from the list', { code: 'INVALID_VARIANT' });
  }
  const { rules } = category;
  const tiers = [...input.tiers].sort((a, b) => a.size - b.size);
  assertValidTiers(tiers, rules);
  if (input.deadlineDays < rules.deadlineDays.min || input.deadlineDays > rules.deadlineDays.max) {
    throw new ApiError(
      422,
      `The deadline must be ${rules.deadlineDays.min} to ${rules.deadlineDays.max} days away`,
      {
        code: 'INVALID_DEADLINE',
      },
    );
  }

  const top = tiers.at(-1).size;
  let group = null;
  for (let attempt = 0; attempt < 5 && !group; attempt += 1) {
    try {
      group = await Group.create({
        type: GROUP_TYPE.SELLER_LED,
        visibility: GROUP_VISIBILITY.PUBLIC,
        inviteCode: generateCode(8),
        productId: product._id,
        variantKey: input.variantKey || null,
        categoryId: category._id,
        cityId: input.cityId,
        sellerId,
        note: input.note,
        targetSize: top,
        maxSize: top,
        tiers,
        basePricePaise: input.basePricePaise,
        tokenAmountPaise: rules.tokenAmountPaise,
        backoutFeePaise: Math.min(rules.backoutFeePaise ?? 0, rules.tokenAmountPaise),
        deadline: new Date(Date.now() + input.deadlineDays * DAY_MS),
        statusHistory: [
          { to: GROUP_STATUS.OPEN, reason: 'deal_published', byType: 'user', by: userId },
        ],
      });
    } catch (err) {
      if (err?.code !== 11000 || !err.keyPattern?.inviteCode) throw err;
    }
  }
  log.info({ groupId: String(group._id), sellerId }, 'Seller deal published');
  return toDealerDeal(group.toObject(), product);
};

/** Dealer view of one deal. */
const toDealerDeal = (group, product) => ({
  groupId: String(group._id),
  product: product ? toProductCard(product, String(group.cityId)) : null,
  status: group.status,
  memberCount: group.memberCount,
  targetSize: group.targetSize,
  deadline: group.deadline,
  basePricePaise: group.basePricePaise,
  tiers: group.tiers,
  ...dealStatus(group, group.memberCount),
  winningPricePaise: group.winningPricePaise ?? null,
});

/**
 * The dealer's deals, newest first.
 * @param {string} sellerId - Dealer
 * @param {{ page?: string, limit?: string }} query
 */
const listSellerDeals = async (sellerId, query) => {
  const pagination = getPagination(query);
  const filter = { sellerId, type: GROUP_TYPE.SELLER_LED };
  const [groups, total] = await Promise.all([
    Group.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('productId', 'brand model slug categoryId images variants priceByCity')
      .lean(),
    Group.countDocuments(filter),
  ]);
  return {
    deals: groups.map((group) =>
      toDealerDeal({ ...group, productId: group.productId?._id }, group.productId),
    ),
    meta: buildPaginationMeta(total, pagination),
  };
};

/* ----------------------------- Live tiers / close ----------------------------- */

/**
 * After someone joins a seller-led deal: if a tier was just reached, tell everyone.
 * @param {Object} group - Group after the join (memberCount includes the new member)
 * @returns {Promise<boolean>} true when a tier unlocked
 */
const onDealMemberJoined = async (group) => {
  if (group.type !== GROUP_TYPE.SELLER_LED) return false;
  const unlocked = (group.tiers || []).find((tier) => tier.size === group.memberCount);
  if (!unlocked) return false;
  const status = dealStatus(group, group.memberCount);
  emitToGroup(group._id, SOCKET_EVENTS.DEAL_TIER, {
    memberCount: group.memberCount,
    tier: status.currentTier,
    nextTier: status.nextTier,
    pricePaise: status.pricePaise,
  });
  await notifyGroupMembers(group, NOTIFICATION_TYPE.TIER_UNLOCKED, {
    price: formatINR(status.pricePaise),
  });
  return true;
};

/**
 * A seller-led deal is done (full, or deadline at tier 1+): won at the tier reached.
 * @param {Object} group - Group document (full, or open past its deadline)
 * @param {string} reason - statusHistory reason
 * @returns {Promise<Object>} Updated group
 */
const closeSellerDeal = async (group, reason) => {
  const settings = await getAuctionSettings();
  const { pricePaise } = dealStatus(group, group.memberCount);
  const updated = await transition(group, GROUP_STATUS.WON, {
    reason,
    set: {
      winningPricePaise: pricePaise,
      exitWindowEndsAt: new Date(Date.now() + settings.exitWindowHours * HOUR_MS),
    },
  });
  await issueDealCodes(group._id);
  const seller = await Seller.findById(group.sellerId).select('businessName').lean();
  await notifyGroupMembers(updated, NOTIFICATION_TYPE.AUCTION_WON, {
    price: formatINR(pricePaise),
    dealerName: seller?.businessName || 'The dealer',
  });
  log.info({ groupId: String(group._id), pricePaise, reason }, 'Seller deal won');
  return updated;
};

module.exports = {
  tierPricePaise,
  dealStatus,
  assertValidTiers,
  createDeal,
  listSellerDeals,
  onDealMemberJoined,
  closeSellerDeal,
};
