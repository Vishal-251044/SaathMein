/**
 * Reviews (TRU-2): only the buyer of a completed purchase, once; the dealer's rating
 * average updates atomically with the review.
 */
jest.mock('../../../src/utils/transaction', () => ({
  withTransaction: jest.fn(async (work) => work({ id: 'session' })),
}));

jest.mock('../../../src/services/trust/rating.service', () => ({
  recomputeSellerRating: jest.fn(async () => ({ rating: 5, ratingCount: 1, reviewCount: 1 })),
}));

const { Types } = require('mongoose');
const Purchase = require('../../../src/models/purchase.model');
const Review = require('../../../src/models/review.model');
const { recomputeSellerRating } = require('../../../src/services/trust/rating.service');
const { createReview } = require('../../../src/services/purchases/review.service');
const { computeRating } = jest.requireActual('../../../src/services/trust/rating.service');

const userId = String(new Types.ObjectId());
const purchaseId = String(new Types.ObjectId());
const sellerId = new Types.ObjectId();
const lean = (value) => ({ lean: async () => value });

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('rating aggregate (penalties count as 1-star, decided 12 Nov 2026)', () => {
  it('averages reviews and penalties', () => {
    expect(computeRating({ sum: 0, count: 0, penalties: 0 })).toEqual({
      rating: 0,
      ratingCount: 0,
      reviewCount: 0,
    });
    expect(computeRating({ sum: 9, count: 2, penalties: 0 })).toEqual({
      rating: 4.5,
      ratingCount: 2,
      reviewCount: 2,
    });
    // Two 5-star reviews and one rating penalty: (10 + 1) / 3
    expect(computeRating({ sum: 10, count: 2, penalties: 1 })).toEqual({
      rating: 3.67,
      ratingCount: 3,
      reviewCount: 2,
    });
  });
});

describe('createReview', () => {
  it('saves the review and updates the dealer rating in one transaction', async () => {
    jest
      .spyOn(Purchase, 'findOne')
      .mockReturnValue(lean({ _id: purchaseId, userId, sellerId, status: 'completed' }));
    jest.spyOn(Purchase, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
    jest
      .spyOn(Review, 'create')
      .mockResolvedValue([{ _id: 'r1', rating: 5, createdAt: new Date() }]);

    await createReview(userId, { purchaseId, rating: 5, text: 'Great' });
    expect(Review.create.mock.calls[0][1]).toEqual({ session: { id: 'session' } });
    expect(recomputeSellerRating).toHaveBeenCalledWith(sellerId);
  });

  it('only after the purchase is completed', async () => {
    jest.spyOn(Purchase, 'findOne').mockReturnValue(lean({ _id: purchaseId, status: 'pending' }));
    await expect(createReview(userId, { purchaseId, rating: 4 })).rejects.toMatchObject({
      code: 'PURCHASE_NOT_COMPLETED',
    });
  });

  it('only once per purchase', async () => {
    jest
      .spyOn(Purchase, 'findOne')
      .mockReturnValue(lean({ _id: purchaseId, status: 'completed', reviewedAt: new Date() }));
    await expect(createReview(userId, { purchaseId, rating: 4 })).rejects.toMatchObject({
      code: 'ALREADY_REVIEWED',
    });
  });

  it("not someone else's purchase", async () => {
    jest.spyOn(Purchase, 'findOne').mockReturnValue(lean(null));
    await expect(createReview(userId, { purchaseId, rating: 4 })).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
