/**
 * Home feed (DIS-1, `GET /feed/home`) — rule-based ranking v1 for the buyer's city:
 * - Banners and Featured deals from Admin → Curation (F34)
 * - Near you: open groups in my area, ranked (fill, urgency, my interests, freshness)
 * - Ending soon: open groups closing within 72 h
 * - Almost full: open groups at 60%+ of their target
 * - Seller deals: seller-led tier deals (feature flag)
 * - Trending: most joins in the last 48 h (cached 5 min per city)
 * - Categories in the admin's order
 * Community groups never appear (GRP-6). "Groups for You" (AI) replaces Near you on Day 16.
 */
const Group = require('../../models/group.model');
const GroupMember = require('../../models/groupMember.model');
const User = require('../../models/user.model');
const CurationItem = require('../../models/curationItem.model');
const { remember } = require('../cache.service');
const { getFeatureFlags } = require('../settings.service');
const { getActiveCategoryTree } = require('../category.service');
const { toGroupCard } = require('../groups/groupPresenter');
const {
  CURATION_TYPE,
  GROUP_STATUS,
  GROUP_TYPE,
  GROUP_VISIBILITY,
  MEMBER_STATUS,
} = require('../../constants/enums');

const HOUR_MS = 60 * 60 * 1000;
const SECTION_SIZE = 10;
const CANDIDATES = 60;
const ENDING_SOON_HOURS = 72;
const ALMOST_FULL_RATIO = 0.6;
const TRENDING_HOURS = 48;
const TRENDING_TTL_SECONDS = 5 * 60;
const PRODUCT_FIELDS = 'brand model slug categoryId images variants priceByCity';
const LIVE = [GROUP_STATUS.OPEN, GROUP_STATUS.FULL, GROUP_STATUS.AUCTION_LIVE];

/* ------------------------------ Ranking (pure) ------------------------------ */

/**
 * Ranking v1 score in [0, 1]: 40% how full, 30% how soon it closes (within 7 days),
 * 20% matches my interests, 10% how new.
 * @param {Object} group - Lean group
 * @param {{ interestCategoryIds?: Set<string> }} viewer
 * @param {Date} now
 * @returns {number}
 */
const scoreGroup = (group, { interestCategoryIds = new Set() } = {}, now = new Date()) => {
  const fill = group.targetSize ? Math.min(1, group.memberCount / group.targetSize) : 0;
  const hoursLeft = Math.max(0, (new Date(group.deadline).getTime() - now.getTime()) / HOUR_MS);
  const urgency = 1 - Math.min(1, hoursLeft / (7 * 24));
  const interest = interestCategoryIds.has(String(group.categoryId)) ? 1 : 0;
  const ageDays = (now.getTime() - new Date(group.createdAt || now).getTime()) / (24 * HOUR_MS);
  const freshness = 1 - Math.min(1, ageDays / 14);
  return 0.4 * fill + 0.3 * urgency + 0.2 * interest + 0.1 * freshness;
};

/** @param {Object[]} groups @param {Object} viewer @param {Date} now @returns {Object[]} Best first */
const rankGroups = (groups, viewer, now) =>
  [...groups].sort((a, b) => scoreGroup(b, viewer, now) - scoreGroup(a, viewer, now));

/** @param {Object} group @returns {number} memberCount / targetSize */
const fillRatio = (group) => (group.targetSize ? group.memberCount / group.targetSize : 0);

/* --------------------------------- Loaders ---------------------------------- */

/** Public live groups of a city matching an extra filter. */
const loadGroups = (cityId, filter, sort = { deadline: 1 }, limit = CANDIDATES) =>
  Group.find({ cityId, visibility: GROUP_VISIBILITY.PUBLIC, ...filter })
    .sort(sort)
    .limit(limit)
    .populate('productId', PRODUCT_FIELDS)
    .lean();

/**
 * Group ids with the most joins in the last 48 h, for one city (cached 5 min).
 * @param {string} cityId
 * @param {Date} now
 * @returns {Promise<{ groupId: string, joins: number }[]>}
 */
const trendingIds = (cityId, now) =>
  remember(`feed:trending:${cityId}`, TRENDING_TTL_SECONDS, async () => {
    const since = new Date(now.getTime() - TRENDING_HOURS * HOUR_MS);
    const cityGroups = await Group.find({
      cityId,
      visibility: GROUP_VISIBILITY.PUBLIC,
      status: { $in: LIVE },
    })
      .select('_id')
      .limit(500)
      .lean();
    if (!cityGroups.length) return [];
    const rows = await GroupMember.aggregate([
      {
        $match: {
          groupId: { $in: cityGroups.map((group) => group._id) },
          joinedAt: { $gte: since },
          status: { $in: [MEMBER_STATUS.ACTIVE, MEMBER_STATUS.ACCEPTED, MEMBER_STATUS.PURCHASED] },
        },
      },
      { $group: { _id: '$groupId', joins: { $sum: 1 } } },
      { $sort: { joins: -1 } },
      { $limit: 20 },
    ]);
    return rows.map((row) => ({ groupId: String(row._id), joins: row.joins }));
  });

/**
 * Banners and featured groups for a city, within their dates.
 * @param {string|null} cityId
 * @param {Date} now
 */
const loadCuration = (cityId, now) =>
  CurationItem.find({
    active: true,
    $and: [
      { $or: [{ cityId: null }, { cityId: { $exists: false } }, ...(cityId ? [{ cityId }] : [])] },
      { $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gt: now } }] },
    ],
  })
    .sort({ order: 1, createdAt: -1 })
    .limit(30)
    .lean();

/** Banner for the app (translations picked on the phone). */
const toBanner = (item) => ({
  id: String(item._id),
  title: item.title || '',
  titleTranslations: item.titleTranslations || {},
  subtitle: item.subtitle || null,
  subtitleTranslations: item.subtitleTranslations || {},
  imageUrl: item.image?.url || null,
  linkPath: item.linkPath || null,
});

/* ----------------------------------- Feed ----------------------------------- */

/**
 * Home feed for a viewer.
 * @param {{ userId?: string }} viewer
 * @param {{ cityId?: string }} query - City override (guests, city switcher)
 * @param {Date} [now]
 * @returns {Promise<{ cityId: string|null, banners: Object[], sections: { key: string, groups: Object[] }[], categories: Object[] }>}
 */
const getHomeFeed = async (viewer = {}, query = {}, now = new Date()) => {
  const user = viewer.userId
    ? await User.findById(viewer.userId).select('cityId area interests').lean()
    : null;
  const cityId = query.cityId || (user?.cityId ? String(user.cityId) : null);
  const [flags, categories, curation] = await Promise.all([
    getFeatureFlags(),
    getActiveCategoryTree(),
    loadCuration(cityId, now),
  ]);
  const banners = curation.filter((item) => item.type === CURATION_TYPE.BANNER).map(toBanner);
  if (!cityId) return { cityId: null, banners, sections: [], categories };

  const viewerCtx = {
    interestCategoryIds: new Set((user?.interests?.categories || []).map(String)),
  };
  const card = (group) => toGroupCard(group, { viewerId: viewer.userId });
  const take = (groups) => groups.slice(0, SECTION_SIZE).map(card);
  const open = { status: GROUP_STATUS.OPEN };

  const featuredIds = curation
    .filter((item) => item.type === CURATION_TYPE.FEATURED_GROUP && item.groupId)
    .map((item) => item.groupId);

  const [featured, nearYou, endingSoon, almostFull, sellerDeals, trending] = await Promise.all([
    featuredIds.length
      ? loadGroups(cityId, { _id: { $in: featuredIds }, status: { $in: LIVE } })
      : [],
    user?.area ? loadGroups(cityId, { ...open, area: user.area }) : [],
    loadGroups(cityId, {
      ...open,
      deadline: { $gt: now, $lte: new Date(now.getTime() + ENDING_SOON_HOURS * HOUR_MS) },
    }),
    loadGroups(cityId, {
      ...open,
      $expr: { $gte: ['$memberCount', { $multiply: ['$targetSize', ALMOST_FULL_RATIO] }] },
    }),
    flags.sellerDeals ? loadGroups(cityId, { ...open, type: GROUP_TYPE.SELLER_LED }) : [],
    trendingIds(cityId, now).then(async (rows) => {
      if (!rows.length) return [];
      const order = new Map(rows.map((row, index) => [row.groupId, index]));
      const groups = await loadGroups(cityId, {
        _id: { $in: rows.map((row) => row.groupId) },
        status: { $in: LIVE },
      });
      return groups.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id)));
    }),
  ]);

  // Featured keeps the admin's order
  const featuredOrder = new Map(featuredIds.map((id, index) => [String(id), index]));
  const sections = [
    {
      key: 'featured',
      groups: take(
        featured.sort(
          (a, b) => featuredOrder.get(String(a._id)) - featuredOrder.get(String(b._id)),
        ),
      ),
    },
    { key: 'near_you', groups: take(rankGroups(nearYou, viewerCtx, now)) },
    { key: 'ending_soon', groups: take(endingSoon) },
    {
      key: 'almost_full',
      groups: take([...almostFull].sort((a, b) => fillRatio(b) - fillRatio(a))),
    },
    { key: 'seller_deals', groups: take(rankGroups(sellerDeals, viewerCtx, now)) },
    { key: 'trending', groups: take(trending) },
  ].filter((section) => section.groups.length);

  return { cityId, banners, sections, categories };
};

module.exports = { scoreGroup, rankGroups, fillRatio, getHomeFeed };
