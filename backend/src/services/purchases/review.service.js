/**
 * Reviews (TRU-2, F28): only a buyer whose purchase completed can rate that dealer, once
 * per purchase. The dealer's average rating and count update atomically in the same
 * transaction. Abusive words are masked like chat messages.
 */
const Purchase = require('../../models/purchase.model');
const Review = require('../../models/review.model');
const Seller = require('../../models/seller.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { withTransaction } = require('../../utils/transaction');
const { filterProfanity } = require('../chat/profanity');
const { PURCHASE_STATUS } = require('../../constants/enums');

const log = createLogger('ReviewService');

/**
 * New average after one more rating (pure, for tests), rounded to 2 decimals.
 * @param {number} average - Current average (0 when none)
 * @param {number} count - Current number of ratings
 * @param {number} rating - New rating 1–5
 * @returns {{ rating: number, ratingCount: number }}
 */
const addRating = (average, count, rating) => ({
  rating: Math.round((((average || 0) * (count || 0) + rating) / ((count || 0) + 1)) * 100) / 100,
  ratingCount: (count || 0) + 1,
});

/**
 * Review the dealer of a completed purchase.
 * @param {string} userId - Buyer
 * @param {{ purchaseId: string, rating: number, text?: string }} input
 * @returns {Promise<Object>} The review
 * @throws {ApiError} 404 not mine, 409 not completed / already reviewed
 */
const createReview = async (userId, { purchaseId, rating, text }) => {
  const purchase = await Purchase.findOne({ _id: purchaseId, userId }).lean();
  if (!purchase) throw ApiError.notFound('Purchase not found');
  if (purchase.status !== PURCHASE_STATUS.COMPLETED) {
    throw ApiError.conflict('You can review the dealer after your purchase is complete', {
      code: 'PURCHASE_NOT_COMPLETED',
    });
  }
  if (purchase.reviewedAt) {
    throw ApiError.conflict('You already reviewed this purchase', { code: 'ALREADY_REVIEWED' });
  }
  const cleanText = text ? filterProfanity(text).text : undefined;

  const review = await withTransaction(async (session) => {
    const claimed = await Purchase.updateOne(
      { _id: purchaseId, reviewedAt: { $exists: false } },
      { $set: { reviewedAt: new Date() } },
      { session },
    );
    if (!claimed.modifiedCount) {
      throw ApiError.conflict('You already reviewed this purchase', { code: 'ALREADY_REVIEWED' });
    }
    const [created] = await Review.create(
      [
        {
          purchaseId,
          userId,
          sellerId: purchase.sellerId,
          groupId: purchase.groupId,
          rating,
          text: cleanText,
        },
      ],
      { session },
    );
    // Atomic running average (pipeline update reads the current values)
    await Seller.updateOne(
      { _id: purchase.sellerId },
      [
        {
          $set: {
            rating: {
              $round: [
                {
                  $divide: [
                    {
                      $add: [
                        {
                          $multiply: [
                            { $ifNull: ['$rating', 0] },
                            { $ifNull: ['$ratingCount', 0] },
                          ],
                        },
                        rating,
                      ],
                    },
                    { $add: [{ $ifNull: ['$ratingCount', 0] }, 1] },
                  ],
                },
                2,
              ],
            },
            ratingCount: { $add: [{ $ifNull: ['$ratingCount', 0] }, 1] },
          },
        },
      ],
      { session },
    );
    return created;
  });
  log.info({ purchaseId, sellerId: String(purchase.sellerId), rating }, 'Review added');
  return {
    id: String(review._id),
    rating: review.rating,
    text: review.text || null,
    createdAt: review.createdAt,
  };
};

module.exports = { addRating, createReview };
