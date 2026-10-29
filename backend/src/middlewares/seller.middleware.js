/**
 * Dealer dashboard guards (PRD §8.2 seller roles). Use after requireAuth.
 * - requireSeller: the user belongs to an active dealer team → `req.seller = { sellerId, role }`
 * - requireSellerOwner: only the owner (KYC, bank, team).
 * The database is checked on every request, so a removed staff member loses access at once.
 */
const SellerStaff = require('../models/sellerStaff.model');
const Seller = require('../models/seller.model');
const ApiError = require('../utils/ApiError');
const { ACCOUNT_STATUS } = require('../constants/enums');

/**
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {Function} next - Next middleware
 */
const requireSeller = async (req, res, next) => {
  try {
    if (!req.auth) return next(ApiError.unauthorized());
    const membership = await SellerStaff.findOne({
      userId: req.auth.userId,
      status: 'active',
    }).lean();
    if (!membership) return next(ApiError.forbidden('This account is not part of a dealer team'));

    const seller = await Seller.findById(membership.sellerId).select('status').lean();
    if (!seller) return next(ApiError.forbidden('Dealer account not found'));
    if (seller.status !== ACCOUNT_STATUS.ACTIVE) {
      return next(
        new ApiError(403, 'This dealer account is suspended. Contact SaathMein support.', {
          code: 'SELLER_SUSPENDED',
        }),
      );
    }

    req.seller = { sellerId: String(membership.sellerId), role: membership.role };
    return next();
  } catch (err) {
    return next(err);
  }
};

/**
 * Owner-only actions. Use after requireSeller.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {Function} next - Next middleware
 */
const requireSellerOwner = (req, res, next) => {
  if (req.seller?.role !== 'owner')
    return next(ApiError.forbidden('Only the account owner can do this'));
  return next();
};

module.exports = { requireSeller, requireSellerOwner };
