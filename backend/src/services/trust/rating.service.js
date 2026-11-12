/**
 * Dealer rating aggregate (TRU-2, TRU-5): the average of published reviews where every
 * rating penalty counts as one 1-star rating (decided 12 Nov 2026). Recomputed from the
 * source rows after any change (new review, hidden review, penalty), so it never drifts.
 * `ratingCount` (used by the 3.5 auction rule) includes penalties; `reviewCount` is what
 * buyers see.
 */
const mongoose = require('mongoose');
const Review = require('../../models/review.model');
const Seller = require('../../models/seller.model');

/**
 * Rating from sums (pure, for tests).
 * @param {{ sum: number, count: number, penalties: number }} input
 * @returns {{ rating: number, ratingCount: number, reviewCount: number }}
 */
const computeRating = ({ sum, count, penalties }) => {
  const ratingCount = count + penalties;
  return {
    rating: ratingCount ? Math.round(((sum + penalties * 1) / ratingCount) * 100) / 100 : 0,
    ratingCount,
    reviewCount: count,
  };
};

/**
 * Recompute and store a dealer's rating.
 * @param {string} sellerId
 * @returns {Promise<{ rating: number, ratingCount: number, reviewCount: number }>}
 */
const recomputeSellerRating = async (sellerId) => {
  const id = new mongoose.Types.ObjectId(String(sellerId));
  const [rows, seller] = await Promise.all([
    Review.aggregate([
      { $match: { sellerId: id, status: 'published' } },
      { $group: { _id: null, sum: { $sum: '$rating' }, count: { $sum: 1 } } },
    ]),
    Seller.findById(id).select('penalties.type').lean(),
  ]);
  const penalties = (seller?.penalties || []).filter(
    (penalty) => penalty.type === 'rating_penalty',
  ).length;
  const result = computeRating({ sum: rows[0]?.sum || 0, count: rows[0]?.count || 0, penalties });
  await Seller.updateOne({ _id: id }, { $set: result });
  return result;
};

module.exports = { computeRating, recomputeSellerRating };
