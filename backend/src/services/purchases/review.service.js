/**
 * Reviews (TRU-2, F28): only a buyer whose purchase completed can rate that dealer, once
 * per purchase. The purchase is marked reviewed and the review saved in one
 * transaction; the rating aggregate is then recomputed (Day 12: penalties
 * count as 1-star). Abusive words are masked like chat messages.
 */
const Purchase = require('../../models/purchase.model');
const Review = require('../../models/review.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { withTransaction } = require('../../utils/transaction');
const { filterProfanity } = require('../chat/profanity');
const { recomputeSellerRating } = require('../trust/rating.service');
const { PURCHASE_STATUS } = require('../../constants/enums');

const log = createLogger('ReviewService');

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
    return created;
  });
  // Rating = reviews + rating penalties (each a 1-star), recomputed from the source rows
  await recomputeSellerRating(purchase.sellerId);
  log.info({ purchaseId, sellerId: String(purchase.sellerId), rating }, 'Review added');
  return {
    id: String(review._id),
    rating: review.rating,
    text: review.text || null,
    createdAt: review.createdAt,
  };
};

module.exports = { createReview };
