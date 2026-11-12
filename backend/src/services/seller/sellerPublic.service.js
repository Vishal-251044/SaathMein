/**
 * Public seller listing and profile — verified dealers buyers can see (cards, profile with
 * reviews, TRU-2).
 * Only approved, active sellers; no contact, document or bank details (privacy, PRD §14).
 */
const Seller = require('../../models/seller.model');
const Group = require('../../models/group.model');
const Review = require('../../models/review.model');
const ApiError = require('../../utils/ApiError');
const { KYC_STATUS, ACCOUNT_STATUS, GROUP_STATUS } = require('../../constants/enums');
const {
  distanceKm,
  firstNameOnly,
  getPagination,
  buildPaginationMeta,
} = require('../../helpers/genericFunctions');
const { toPublicSeller } = require('./sellerPresenter');

const MAX_RESULTS = 20;

/**
 * Verified dealers covering a city (and optionally a category), best rated first.
 * @param {{ cityId: string, categoryId?: string, latitude?: number, longitude?: number }} query
 * @returns {Promise<Object[]>} Public sellers (with distance when a location is given)
 */
const listVerifiedSellers = async ({ cityId, categoryId, latitude, longitude }) => {
  const filter = {
    cities: cityId,
    'kyc.status': KYC_STATUS.APPROVED,
    status: ACCOUNT_STATUS.ACTIVE,
  };
  if (categoryId) filter.categories = categoryId;

  const sellers = await Seller.find(filter)
    .select('businessName address rating ratingCount reviewCount kyc.status geo')
    .sort({ rating: -1, ratingCount: -1 })
    .limit(MAX_RESULTS)
    .lean();

  const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);
  return sellers.map((seller) =>
    toPublicSeller(seller, {
      distanceKm:
        hasLocation && seller.geo?.coordinates
          ? Math.round(distanceKm([longitude, latitude], seller.geo.coordinates) * 10) / 10
          : null,
    }),
  );
};

/**
 * A verified dealer's public profile (TRU-2): name, area, verified badge, rating (with
 * penalties) and number of reviews, member since, and how many groups they won.
 * @param {string} sellerId
 * @returns {Promise<Object>}
 * @throws {ApiError} 404 for unknown, unverified or suspended dealers
 */
const getPublicSeller = async (sellerId) => {
  const seller = await Seller.findOne({
    _id: sellerId,
    'kyc.status': KYC_STATUS.APPROVED,
    status: ACCOUNT_STATUS.ACTIVE,
  })
    .select('businessName address rating ratingCount reviewCount kyc.status categories createdAt')
    .lean();
  if (!seller) throw ApiError.notFound('Dealer not found');
  const groupsWon = await Group.countDocuments({
    sellerId,
    status: { $in: [GROUP_STATUS.WON, GROUP_STATUS.PURCHASING, GROUP_STATUS.COMPLETED] },
  });
  return {
    ...toPublicSeller(seller),
    categoryIds: (seller.categories || []).map(String),
    memberSince: seller.createdAt,
    groupsWon,
  };
};

/**
 * Published reviews of a dealer, newest first (first names only).
 * @param {string} sellerId
 * @param {{ page?: string, limit?: string }} query
 */
const listSellerReviews = async (sellerId, query = {}) => {
  const pagination = getPagination(query);
  const filter = { sellerId, status: 'published' };
  const [rows, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('userId', 'name')
      .lean(),
    Review.countDocuments(filter),
  ]);
  return {
    reviews: rows.map((review) => ({
      id: String(review._id),
      rating: review.rating,
      text: review.text || null,
      buyerFirstName: firstNameOnly(review.userId?.name) || null,
      createdAt: review.createdAt,
    })),
    meta: buildPaginationMeta(total, pagination),
  };
};

module.exports = { listVerifiedSellers, getPublicSeller, listSellerReviews };
