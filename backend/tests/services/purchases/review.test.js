/**
 * Reviews (TRU-2): only the buyer of a completed purchase, once; the dealer's rating
 * average updates atomically with the review.
 */
jest.mock('../../../src/utils/transaction', () => ({
  withTransaction: jest.fn(async (work) => work({ id: 'session' })),
}));

const { Types } = require('mongoose');
const Purchase = require('../../../src/models/purchase.model');
const Review = require('../../../src/models/review.model');
const Seller = require('../../../src/models/seller.model');
const { addRating, createReview } = require('../../../src/services/purchases/review.service');

const userId = String(new Types.ObjectId());
const purchaseId = String(new Types.ObjectId());
const sellerId = new Types.ObjectId();
const lean = (value) => ({ lean: async () => value });

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('rating average', () => {
  it('adds one rating to the running average', () => {
    expect(addRating(0, 0, 4)).toEqual({ rating: 4, ratingCount: 1 });
    expect(addRating(4, 1, 5)).toEqual({ rating: 4.5, ratingCount: 2 });
    expect(addRating(4.5, 2, 3)).toEqual({ rating: 4, ratingCount: 3 });
    expect(addRating(4.67, 3, 4)).toEqual({ rating: 4.5, ratingCount: 4 });
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
    const sellerUpdate = jest.spyOn(Seller, 'updateOne').mockResolvedValue({});

    await createReview(userId, { purchaseId, rating: 5, text: 'Great' });
    expect(Review.create.mock.calls[0][1]).toEqual({ session: { id: 'session' } });
    expect(sellerUpdate.mock.calls[0][0]).toEqual({ _id: sellerId });
    expect(Array.isArray(sellerUpdate.mock.calls[0][1])).toBe(true); // pipeline (atomic)
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
