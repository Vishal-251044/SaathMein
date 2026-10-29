/**
 * Public seller listing — verified dealers buyers can see (seller profile cards).
 * Only approved, active sellers; no contact, document or bank details (privacy, PRD §14).
 */
const Seller = require('../../models/seller.model');
const { KYC_STATUS, ACCOUNT_STATUS } = require('../../constants/enums');
const { distanceKm } = require('../../helpers/genericFunctions');
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
    .select('businessName address rating ratingCount kyc.status geo')
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

module.exports = { listVerifiedSellers };
