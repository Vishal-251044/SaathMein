/**
 * Who may bid in an auction (PRD §10.5 "Who can bid", AUC-1, decided 8 Nov 2026):
 * KYC-verified, active, covering the group's city and category, not suspended from
 * auctions, and rated 3.5+ — except dealers with fewer than 3 reviews (unrated), who may
 * bid until they have enough reviews to be rated (open question 2).
 * Also the auction ceiling: the first bid must be below the city's catalog price.
 */
const Seller = require('../../models/seller.model');
const Product = require('../../models/product.model');
const { KYC_STATUS, ACCOUNT_STATUS } = require('../../constants/enums');

/**
 * Business-level reasons (not about the group): KYC, account, suspension, rating.
 * @param {Object} seller - Lean seller
 * @param {{ minRating: number, minReviewsForRating: number }} settings
 * @param {Date} [now]
 * @returns {string|null} Reason code
 */
const businessIneligibility = (seller, settings, now = new Date()) => {
  if (!seller) return 'NOT_A_DEALER';
  if (seller.kyc?.status !== KYC_STATUS.APPROVED) return 'KYC_NOT_APPROVED';
  if (seller.status !== ACCOUNT_STATUS.ACTIVE) return 'SELLER_SUSPENDED';
  const suspended = (seller.penalties || []).some(
    (penalty) =>
      penalty.type === 'auction_suspension' &&
      !penalty.liftedAt && // lifted early by staff (Day 13)
      (!penalty.until || new Date(penalty.until) > now),
  );
  if (suspended) return 'AUCTIONS_SUSPENDED';
  const isRated = (seller.ratingCount || 0) >= settings.minReviewsForRating;
  if (isRated && (seller.rating || 0) < settings.minRating) return 'RATING_TOO_LOW';
  return null;
};

/**
 * Why a dealer may not bid, or null when they may.
 * @param {Object} seller - Lean seller
 * @param {Object} group - Lean group
 * @param {{ minRating: number, minReviewsForRating: number }} settings
 * @param {Date} [now]
 * @returns {string|null} Reason code
 */
const ineligibilityReason = (seller, group, settings, now = new Date()) => {
  const business = businessIneligibility(seller, settings, now);
  if (business) return business;
  const has = (list, id) => (list || []).some((item) => String(item) === String(id));
  if (!has(seller.cities, group.cityId)) return 'CITY_NOT_COVERED';
  if (!has(seller.categories, group.categoryId)) return 'CATEGORY_NOT_COVERED';
  return null;
};

/**
 * Mongo filter for every eligible dealer of a group (notifications, dealer lists).
 * @param {Object} group - Lean group
 * @param {{ minRating: number, minReviewsForRating: number }} settings
 * @param {Date} [now]
 * @returns {Object}
 */
const eligibleSellerFilter = (group, settings, now = new Date()) => ({
  'kyc.status': KYC_STATUS.APPROVED,
  status: ACCOUNT_STATUS.ACTIVE,
  cities: group.cityId,
  categories: group.categoryId,
  penalties: {
    $not: {
      $elemMatch: {
        type: 'auction_suspension',
        liftedAt: { $exists: false },
        $or: [{ until: null }, { until: { $gt: now } }],
      },
    },
  },
  $or: [
    { ratingCount: { $lt: settings.minReviewsForRating } },
    { rating: { $gte: settings.minRating } },
  ],
});

/** @param {Object} group @param {Object} settings @returns {Promise<Object[]>} Eligible dealers */
const findEligibleSellers = (group, settings) =>
  Seller.find(eligibleSellerFilter(group, settings)).select('_id businessName contactEmail').lean();

/**
 * Starting ceiling (AUC-3): the city's headline catalog price (on-road, else ex-showroom,
 * else MRP) for the group's variant; for "any variant", the cheapest variant (buyer-friendly).
 * @param {Object} group - Lean group
 * @returns {Promise<number|null>} Paise, or null when the catalog has no price
 */
const auctionCeilingPaise = async (group) => {
  const product = await Product.findById(group.productId).select('priceByCity').lean();
  const prices = (product?.priceByCity || [])
    .filter((price) => String(price.cityId) === String(group.cityId))
    .filter(
      (price) =>
        !group.variantKey || price.variantKey === group.variantKey || price.variantKey == null,
    )
    .map((price) => price.onRoadPaise ?? price.exShowroomPaise ?? price.mrpPaise)
    .filter((value) => Number.isSafeInteger(value) && value > 0);
  return prices.length ? Math.min(...prices) : null;
};

module.exports = {
  businessIneligibility,
  ineligibilityReason,
  eligibleSellerFilter,
  findEligibleSellers,
  auctionCeilingPaise,
};
