/**
 * Groups (PRD §10.3, GRP-1 to GRP-8): create a buyer-led group, list and search open
 * groups, similar groups ("join this one instead?"), the group page, My Groups and the
 * leader's actions (extend once / start early / cancel an empty group).
 *
 * Joining = paying the token (Day 7, PAY-2). Until then `memberCount` only counts paid
 * members, so a new group shows "0 of N" — including the leader (decided 30 Oct 2026).
 */
const Group = require('../../models/group.model');
const GroupMember = require('../../models/groupMember.model');
const Product = require('../../models/product.model');
const Category = require('../../models/category.model');
const User = require('../../models/user.model');
const Seller = require('../../models/seller.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const {
  generateCode,
  getPagination,
  buildPaginationMeta,
} = require('../../helpers/genericFunctions');
const { recordSignal } = require('../demandSignal.service');
const { getGroupSettings } = require('../settings.service');
const { transition, earlyStartMinimum } = require('./stateMachine');
const { toGroupCard, toGroupDetail } = require('./groupPresenter');
const { toPublicSeller } = require('../seller/sellerPresenter');
const {
  GROUP_STATUS,
  GROUP_TYPE,
  GROUP_VISIBILITY,
  MEMBER_STATUS,
} = require('../../constants/enums');

const log = createLogger('GroupService');

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const PRODUCT_FIELDS = 'brand model slug categoryId images variants priceByCity';
const INVITE_CODE_ATTEMPTS = 5;

/** Membership statuses that hold a seat. */
const SEATED = [MEMBER_STATUS.ACTIVE, MEMBER_STATUS.ACCEPTED, MEMBER_STATUS.PURCHASED];
/** Membership statuses shown under "Joined" in My Groups. */
const MY_GROUP_STATUSES = [
  ...SEATED,
  MEMBER_STATUS.WAITLISTED,
  MEMBER_STATUS.PENDING_APPROVAL,
  MEMBER_STATUS.APPROVED,
];
/** Statuses buyers can browse. */
const LIVE_STATUSES = [GROUP_STATUS.OPEN, GROUP_STATUS.FULL, GROUP_STATUS.AUCTION_LIVE];

/**
 * The logged-in buyer (must have chosen a city).
 * @param {string} userId - User id
 * @returns {Promise<Object>} Lean user
 * @throws {ApiError} 422 CITY_REQUIRED
 */
const loadBuyer = async (userId) => {
  const user = await User.findById(userId).select('name cityId').lean();
  if (!user) throw ApiError.unauthorized();
  if (!user.cityId) {
    throw new ApiError(422, 'Choose your city first', { code: 'CITY_REQUIRED' });
  }
  return user;
};

/**
 * Create a buyer-led group (GRP-1). The amount of the token, sizes and deadline range come
 * from the category rules (admin-editable), never from the client.
 * @param {string} userId - Leader
 * @param {{ productId: string, variantKey?: string|null, targetSize: number, deadlineDays: number,
 *   visibility: 'public'|'community', requiresApproval?: boolean, note?: string }} input
 * @returns {Promise<Object>} Group page data
 * @throws {ApiError} 404 product, 422 rule violations, 429 TOO_MANY_GROUPS
 */
const createGroup = async (userId, input) => {
  const [user, settings] = await Promise.all([loadBuyer(userId), getGroupSettings()]);

  const product = await Product.findOne({ _id: input.productId, active: true }).lean();
  if (!product) throw ApiError.notFound('This product is not available');
  const category = await Category.findOne({ _id: product.categoryId, active: true }).lean();
  if (!category) {
    throw new ApiError(422, 'Groups are not open for this category yet', {
      code: 'CATEGORY_INACTIVE',
    });
  }

  const variantKey = input.variantKey || null;
  if (variantKey && !product.variants?.some((variant) => variant.key === variantKey)) {
    throw new ApiError(422, 'Pick a variant from the list', { code: 'INVALID_VARIANT' });
  }

  const { rules } = category;
  if (input.targetSize < rules.minSize || input.targetSize > rules.maxSize) {
    throw new ApiError(422, `Group size must be between ${rules.minSize} and ${rules.maxSize}`, {
      code: 'INVALID_SIZE',
      details: { min: rules.minSize, max: rules.maxSize },
    });
  }
  if (input.deadlineDays < rules.deadlineDays.min || input.deadlineDays > rules.deadlineDays.max) {
    throw new ApiError(
      422,
      `The deadline must be ${rules.deadlineDays.min} to ${rules.deadlineDays.max} days away`,
      { code: 'INVALID_DEADLINE', details: rules.deadlineDays },
    );
  }

  const openLed = await Group.countDocuments({ leaderId: userId, status: GROUP_STATUS.OPEN });
  if (openLed >= settings.maxOpenGroupsPerLeader) {
    throw new ApiError(
      429,
      `You already lead ${openLed} open groups. Wait for one to finish before starting another.`,
      { code: 'TOO_MANY_GROUPS' },
    );
  }

  const isCommunity = input.visibility === GROUP_VISIBILITY.COMMUNITY;
  const now = Date.now();
  let group = null;
  // Invite codes are random; retry on the (very rare) duplicate
  for (let attempt = 0; attempt < INVITE_CODE_ATTEMPTS && !group; attempt += 1) {
    try {
      group = await Group.create({
        type: GROUP_TYPE.BUYER_LED,
        visibility: input.visibility,
        inviteCode: generateCode(8),
        requiresApproval: isCommunity && Boolean(input.requiresApproval),
        productId: product._id,
        variantKey,
        categoryId: category._id,
        cityId: user.cityId,
        leaderId: userId,
        note: input.note,
        targetSize: input.targetSize,
        maxSize: input.targetSize,
        tokenAmountPaise: rules.tokenAmountPaise, // snapshot: later rule edits do not change it
        backoutFeePaise: Math.min(rules.backoutFeePaise ?? 0, rules.tokenAmountPaise),
        deadline: new Date(now + input.deadlineDays * DAY_MS),
        statusHistory: [{ to: GROUP_STATUS.OPEN, reason: 'created', byType: 'user', by: userId }],
      });
    } catch (err) {
      if (err?.code !== 11000 || !err.keyPattern?.inviteCode) throw err;
    }
  }
  if (!group) throw new Error('Could not generate a unique invite code');

  await recordSignal({
    userId,
    type: 'interest',
    productId: product._id,
    categoryId: category._id,
    brand: product.brand,
    cityId: user.cityId,
  });
  log.info({ groupId: String(group._id), userId, productId: String(product._id) }, 'Group created');
  return getGroup(String(group._id), { userId });
};

/**
 * Can this viewer see a community group?
 * @param {Object} group - Lean group
 * @param {{ userId?: string, code?: string }} viewer
 * @param {Object|null} membership - Viewer's membership
 * @returns {boolean}
 */
const canView = (group, viewer, membership) =>
  group.visibility === GROUP_VISIBILITY.PUBLIC ||
  String(group.leaderId) === String(viewer.userId) ||
  (membership && membership.status !== MEMBER_STATUS.REJECTED) ||
  Boolean(viewer.code && viewer.code.toUpperCase() === group.inviteCode);

/**
 * Group page (GRP-3). Community groups are visible to the leader, members and people
 * with the invite code; everyone else gets 404 (their existence is not revealed).
 * @param {string} groupId - Group id
 * @param {{ userId?: string, code?: string }} viewer
 * @returns {Promise<Object>}
 */
const getGroup = async (groupId, viewer = {}) => {
  const group = await Group.findById(groupId).populate('productId', PRODUCT_FIELDS).lean();
  if (!group) throw ApiError.notFound('Group not found');

  const membership = viewer.userId
    ? await GroupMember.findOne({ groupId, userId: viewer.userId }).lean()
    : null;
  if (!canView(group, viewer, membership)) throw ApiError.notFound('Group not found');

  const [members, leader, settings] = await Promise.all([
    GroupMember.find({ groupId, status: { $in: SEATED } })
      .sort({ joinedAt: 1 })
      .limit(50)
      .populate('userId', 'name avatar')
      .lean(),
    User.findById(group.leaderId).select('name').lean(),
    getGroupSettings(),
  ]);
  const [auction, deal] = await Promise.all([
    getBuyerAuctionLazy(group, viewer),
    group.type === GROUP_TYPE.SELLER_LED ? sellerDealView(group) : null,
  ]);
  return toGroupDetail(group, {
    viewerId: viewer.userId,
    membership,
    members,
    leader,
    settings,
    auction,
    deal,
  });
};

/**
 * Live auction for the group page (AUC-9): falling price, price history, winner,
 * single-dealer decision. Same visibility rules as the group page.
 * @param {string} groupId - Group id
 * @param {{ userId?: string, code?: string }} viewer
 * @returns {Promise<Object>}
 * @throws {ApiError} 404 not visible or no auction
 */
const getGroupAuction = async (groupId, viewer = {}) => {
  const group = await Group.findById(groupId).lean();
  if (!group) throw ApiError.notFound('Group not found');
  const membership = viewer.userId
    ? await GroupMember.findOne({ groupId, userId: viewer.userId }).lean()
    : null;
  if (!canView(group, viewer, membership)) throw ApiError.notFound('Group not found');
  const auction = await getBuyerAuctionLazy(group, viewer);
  if (!auction) throw ApiError.notFound('This group has no auction yet');
  return auction;
};

/**
 * Leader accepts or declines the only dealer's price (decided 8 Nov 2026).
 * @param {string} groupId - Group id
 * @param {string} userId - Leader
 * @param {boolean} accept - true = buy at that price, false = cancel with full refunds
 * @returns {Promise<Object>} Group page
 */
const decideSingleBid = async (groupId, userId, accept) => {
  const auctionService = require('../auction/auction.service');
  await auctionService.decideSingleBid(groupId, userId, accept);
  return getGroup(groupId, { userId });
};

/** Buyer auction view (loaded lazily: the auction services import the state machine). */
const getBuyerAuctionLazy = (group, viewer) => {
  const { getBuyerAuction } = require('../auction/auction.service');
  return getBuyerAuction(group, viewer);
};

/**
 * Seller-led deal for the group page (AUC-9): tiers, price now, "X more to unlock", dealer.
 * @param {Object} group - Lean seller-led group
 * @returns {Promise<Object>}
 */
const sellerDealView = async (group) => {
  const { dealStatus } = require('../deals/deal.service');
  const seller = await Seller.findById(group.sellerId)
    .select('businessName address rating ratingCount kyc.status')
    .lean();
  return {
    basePricePaise: group.basePricePaise,
    tiers: [...(group.tiers || [])]
      .sort((a, b) => a.size - b.size)
      .map((tier) => ({
        size: tier.size,
        discountBps: tier.discountBps,
        pricePaise: dealStatus({ basePricePaise: group.basePricePaise, tiers: [tier] }, tier.size)
          .pricePaise,
      })),
    ...dealStatus(group, group.memberCount),
    seller: seller ? { ...toPublicSeller(seller), address: seller.address || null } : null,
  };
};

/**
 * Browse public groups (GRP-4 lists, product page "open groups").
 * @param {{ cityId?: string, categoryId?: string, productId?: string, status?: string,
 *   sort?: 'ending_soon'|'filling'|'newest', page?: string, limit?: string }} query
 * @param {{ userId?: string }} viewer
 * @returns {Promise<{ groups: Object[], meta: Object }>}
 */
const listGroups = async (query, viewer = {}) => {
  const pagination = getPagination(query);
  let { cityId } = query;
  if (!cityId && viewer.userId) {
    cityId = (await User.findById(viewer.userId).select('cityId').lean())?.cityId;
  }

  const filter = { visibility: GROUP_VISIBILITY.PUBLIC };
  if (cityId) filter.cityId = cityId;
  if (query.categoryId) filter.categoryId = query.categoryId;
  if (query.productId) filter.productId = query.productId;
  filter.status = !query.status || query.status === 'live' ? { $in: LIVE_STATUSES } : query.status;

  const sort =
    query.sort === 'newest'
      ? { createdAt: -1 }
      : query.sort === 'filling'
        ? { memberCount: -1, deadline: 1 }
        : { deadline: 1 };

  const [groups, total] = await Promise.all([
    Group.find(filter)
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('productId', PRODUCT_FIELDS)
      .lean(),
    Group.countDocuments(filter),
  ]);
  return {
    groups: groups.map((group) => toGroupCard(group, { viewerId: viewer.userId })),
    meta: buildPaginationMeta(total, pagination),
  };
};

/**
 * Open public groups for the same product in the buyer's city — offered before creating
 * a new one so demand is not split (GRP-2). Same variant or "any variant" groups match.
 * @param {{ productId: string, variantKey?: string }} query
 * @param {string} userId - Buyer
 * @returns {Promise<Object[]>} Up to 5 group cards, fullest first
 */
const findSimilarGroups = async ({ productId, variantKey }, userId) => {
  const user = await loadBuyer(userId);
  const filter = {
    productId,
    cityId: user.cityId,
    status: GROUP_STATUS.OPEN,
    visibility: GROUP_VISIBILITY.PUBLIC,
    $expr: { $lt: ['$memberCount', '$targetSize'] },
  };
  if (variantKey) filter.variantKey = { $in: [variantKey, null] };

  const groups = await Group.find(filter)
    .sort({ memberCount: -1, deadline: 1 })
    .limit(5)
    .populate('productId', PRODUCT_FIELDS)
    .lean();
  return groups.map((group) => toGroupCard(group, { viewerId: userId }));
};

/**
 * My Groups tab: groups I joined, or groups I lead.
 * @param {string} userId - Buyer
 * @param {{ role?: 'joined'|'leading', page?: string, limit?: string }} query
 * @returns {Promise<{ groups: Object[], meta: Object }>}
 */
const listMyGroups = async (userId, { role = 'joined', ...query }) => {
  const pagination = getPagination(query);
  let filter;
  const memberships = new Map();

  if (role === 'leading') {
    filter = { leaderId: userId };
  } else {
    const rows = await GroupMember.find({ userId, status: { $in: MY_GROUP_STATUSES } })
      .select('groupId status')
      .lean();
    rows.forEach((row) => memberships.set(String(row.groupId), row.status));
    filter = { _id: { $in: rows.map((row) => row.groupId) } };
  }

  const [groups, total] = await Promise.all([
    Group.find(filter)
      .sort({ updatedAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('productId', PRODUCT_FIELDS)
      .lean(),
    Group.countDocuments(filter),
  ]);
  return {
    groups: groups.map((group) => ({
      ...toGroupCard(group, { viewerId: userId }),
      myMembershipStatus: memberships.get(String(group._id)) || null,
    })),
    meta: buildPaginationMeta(total, pagination),
  };
};

/**
 * Load a group the user leads.
 * @param {string} groupId - Group id
 * @param {string} userId - Must be the leader
 * @returns {Promise<Object>} Group document
 * @throws {ApiError} 404 / 403
 */
const loadLedGroup = async (groupId, userId) => {
  const group = await Group.findById(groupId);
  if (!group) throw ApiError.notFound('Group not found');
  if (String(group.leaderId) !== String(userId)) {
    throw ApiError.forbidden('Only the group leader can do this');
  }
  return group;
};

/**
 * Throw unless the leader's extend / start-early window is open.
 * @param {Object} group - Group document
 */
const assertDecisionWindow = (group) => {
  if (group.status !== GROUP_STATUS.OPEN || !group.leaderDecisionDueAt) {
    throw ApiError.conflict('This choice is available only after the deadline, at 70% or more', {
      code: 'NO_DECISION_PENDING',
    });
  }
};

/**
 * Leader extends the deadline once (GRP-5) by settings.extensionDays, never past the
 * category's maximum deadline counted from creation.
 * @param {string} groupId - Group id
 * @param {string} userId - Leader
 * @returns {Promise<Object>} Group page
 * @throws {ApiError} 409 ALREADY_EXTENDED / EXTENSION_NOT_POSSIBLE / NO_DECISION_PENDING
 */
const extendDeadline = async (groupId, userId) => {
  const group = await loadLedGroup(groupId, userId);
  assertDecisionWindow(group);
  if (group.deadlineExtended) {
    throw ApiError.conflict('The deadline can be extended only once', { code: 'ALREADY_EXTENDED' });
  }
  const [settings, category] = await Promise.all([
    getGroupSettings(),
    Category.findById(group.categoryId).select('rules.deadlineDays').lean(),
  ]);
  const maxDays = category?.rules?.deadlineDays?.max ?? 30;
  const latest = group.createdAt.getTime() + maxDays * DAY_MS;
  const newDeadline = Math.min(Date.now() + settings.extensionDays * DAY_MS, latest);
  if (newDeadline - Date.now() < HOUR_MS) {
    throw ApiError.conflict(
      `Groups can run for at most ${maxDays} days. Start the auction now instead.`,
      { code: 'EXTENSION_NOT_POSSIBLE' },
    );
  }

  // Not a status change; conditional so a double tap or the sweep cannot race it
  const updated = await Group.updateOne(
    {
      _id: group._id,
      status: GROUP_STATUS.OPEN,
      deadlineExtended: false,
      leaderDecisionDueAt: { $exists: true },
    },
    {
      $set: { deadline: new Date(newDeadline), deadlineExtended: true },
      $unset: { leaderDecisionDueAt: 1 },
    },
  );
  if (!updated.modifiedCount) {
    throw ApiError.conflict('This group changed a moment ago. Please refresh.', {
      code: 'GROUP_CHANGED',
    });
  }
  log.info({ groupId, userId }, 'Deadline extended');
  return getGroup(groupId, { userId });
};

/**
 * Leader starts the auction early at ≥ 70% after the deadline (GRP-5). Dealers see the
 * real member count; auction rules are the same as for a full group (decided 30 Oct 2026).
 * @param {string} groupId - Group id
 * @param {string} userId - Leader
 * @returns {Promise<Object>} Group page
 */
const startAuctionEarly = async (groupId, userId) => {
  const group = await loadLedGroup(groupId, userId);
  assertDecisionWindow(group);
  const settings = await getGroupSettings();
  // Same start as a full group: category rules, catalog ceiling, dealers invited
  const { startAuction } = require('../auction/auction.service');
  await startAuction(group, {
    reason: 'leader_started_early',
    actor: { type: 'user', id: userId },
    ctx: { thresholdBps: settings.earlyStartThresholdBps },
    unset: { leaderDecisionDueAt: 1 },
    rethrow: true,
  });
  return getGroup(groupId, { userId });
};

/**
 * Leader cancels their own group while nobody has paid (anything else goes through
 * support, because tokens must be refunded).
 * @param {string} groupId - Group id
 * @param {string} userId - Leader
 * @returns {Promise<Object>} Group page
 */
const cancelGroup = async (groupId, userId) => {
  const group = await loadLedGroup(groupId, userId);
  if (group.memberCount > 0) {
    throw ApiError.conflict('People have already paid to join. Contact support to cancel.', {
      code: 'GROUP_HAS_MEMBERS',
    });
  }
  await transition(group, GROUP_STATUS.CANCELLED, {
    reason: 'leader_cancelled',
    actor: { type: 'user', id: userId },
  });
  return getGroup(groupId, { userId });
};

module.exports = {
  getGroupAuction,
  decideSingleBid,
  SEATED,
  createGroup,
  getGroup,
  listGroups,
  findSimilarGroups,
  listMyGroups,
  extendDeadline,
  startAuctionEarly,
  cancelGroup,
  earlyStartMinimum,
};
