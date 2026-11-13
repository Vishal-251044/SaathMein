/**
 * Dealer bids (AUC-3 to AUC-6): breakdown must add up, first bid below the ceiling, every
 * later bid beats the lowest by the minimum step (₹200 or 0.25%, whichever is higher),
 * compare-and-set so two simultaneous bids cannot both win, anti-sniping extension (max 6),
 * only joined + eligible dealers, cooldown between bids.
 */
jest.mock('../../../src/jobs/queues', () => ({ scheduleAuctionClose: jest.fn() }));
jest.mock('../../../src/sockets/emitter', () => ({
  emitToAuction: jest.fn(),
  emitToSeller: jest.fn(),
  emitToStaff: jest.fn(),
}));
jest.mock('../../../src/services/alerts/alert.service', () => ({ raiseAlert: jest.fn() }));
jest.mock('../../../src/services/groups/groupLive', () => ({ notifyGroupMembers: jest.fn() }));
jest.mock('../../../src/services/email.service', () => ({ sendOutbid: jest.fn() }));
jest.mock('../../../src/services/rateLimit.service', () => ({ assertWithinLimit: jest.fn() }));
jest.mock('../../../src/utils/transaction', () => ({
  withTransaction: jest.fn(async (work) => work(null)),
}));
jest.mock('../../../src/services/settings.service', () => ({
  getAuctionSettings: jest.fn(async () => ({
    minRating: 3.5,
    minReviewsForRating: 3,
    bidCooldownSeconds: 3,
    priceAlertMinutes: 30,
  })),
}));
jest.mock('../../../src/services/auction/winner.service', () => ({
  notifyDealer: jest.fn(),
  dealerAuctionUrl: jest.fn(() => 'https://x/auctions/g'),
  productNameOf: jest.fn(async () => 'Honda Activa'),
}));
jest.mock('../../../src/services/auction/auction.service', () => ({
  auctionRulesFor: jest.fn(async () => ({
    minStepPaise: 20_000,
    minStepBps: 25,
    antiSnipeMinutes: 5,
    maxExtensions: 6,
    minDealers: 2,
  })),
  auctionNumbers: jest.fn((group) => ({ lowestPricePaise: group.auction.lowestPricePaise })),
  rankOf: jest.fn(() => 1),
}));

const { Types } = require('mongoose');
const Group = require('../../../src/models/group.model');
const Bid = require('../../../src/models/bid.model');
const Seller = require('../../../src/models/seller.model');
const AuctionDealer = require('../../../src/models/auctionDealer.model');
const { scheduleAuctionClose } = require('../../../src/jobs/queues');
const { notifyDealer } = require('../../../src/services/auction/winner.service');
const {
  breakdownTotal,
  maxAllowedBid,
  placeBid,
} = require('../../../src/services/auction/bid.service');
const { GROUP_STATUS: S } = require('../../../src/constants/enums');

const NOW = new Date('2026-11-08T10:00:00Z');
const MIN = 60_000;
const cityId = new Types.ObjectId();
const categoryId = new Types.ObjectId();
const sellerId = String(new Types.ObjectId());
const otherSeller = new Types.ObjectId();
const dealerUser = { sellerId, userId: String(new Types.ObjectId()) };

const verifiedSeller = (overrides = {}) => ({
  _id: sellerId,
  kyc: { status: 'approved' },
  status: 'active',
  cities: [cityId],
  categories: [categoryId],
  rating: 0,
  ratingCount: 0,
  penalties: [],
  ...overrides,
});

const liveGroup = (auction = {}) => ({
  _id: new Types.ObjectId(),
  status: S.AUCTION_LIVE,
  cityId,
  categoryId,
  auction: {
    ceilingPricePaise: 9_000_000,
    minStepPaise: 20_000,
    minStepBps: 25,
    endsAt: new Date(NOW.getTime() + 60 * MIN),
    extensions: 0,
    ...auction,
  },
});

/** A breakdown that adds up to `price`. */
const priced = (price) => ({
  pricePerUnitPaise: price,
  breakdown: { basePaise: price - 500_000, taxPaise: 400_000, rtoPaise: 100_000 },
});

const lean = (value) => ({ lean: async () => value });
let casWrite;

/** Wire the reads and the compare-and-set write. */
const given = ({ group, dealer = { status: 'joined', priceValidityDays: 7 }, seller, cas }) => {
  jest.spyOn(Group, 'findById').mockReturnValue(lean(group));
  jest.spyOn(AuctionDealer, 'findOne').mockReturnValue(lean(dealer));
  jest
    .spyOn(Seller, 'findById')
    .mockReturnValue({ select: () => lean(seller || verifiedSeller()) });
  jest.spyOn(Bid, 'findById').mockReturnValue({
    select: () => lean(group.auction.lowestBidId ? { sellerId: otherSeller } : null),
  });
  jest
    .spyOn(Bid, 'create')
    .mockImplementation(async ([doc]) => [{ ...doc, _id: new Types.ObjectId(), createdAt: NOW }]);
  casWrite = jest.spyOn(Group, 'findOneAndUpdate').mockImplementation(async (filter, update) =>
    cas === null
      ? null
      : {
          ...group,
          auction: {
            ...group.auction,
            ...Object.fromEntries(
              Object.entries(update.$set).map(([key, value]) => [
                key.replace('auction.', ''),
                value,
              ]),
            ),
          },
        },
  );
  jest.spyOn(AuctionDealer, 'updateOne').mockResolvedValue({});
  jest.spyOn(AuctionDealer, 'find').mockReturnValue(lean([]));
  jest.spyOn(Bid, 'updateOne').mockResolvedValue({});
  jest.spyOn(Group, 'updateOne').mockResolvedValue({ modifiedCount: 0 });
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('bid rules (pure)', () => {
  it('adds every charge and subtracts the discount', () => {
    expect(
      breakdownTotal({
        basePaise: 8_000_000,
        discountPaise: 100_000,
        taxPaise: 50_000,
        rtoPaise: 30_000,
      }),
    ).toBe(7_980_000);
  });

  it('first bid must be strictly below the ceiling', () => {
    expect(maxAllowedBid({ ceilingPricePaise: 9_000_000 })).toEqual({
      maxPaise: 8_999_999,
      stepPaise: 0,
    });
    expect(maxAllowedBid({})).toEqual({ maxPaise: null, stepPaise: 0 });
  });

  it('minimum step is ₹200 or 0.25%, whichever is higher', () => {
    // 0.25% of ₹50,000 = ₹125 → ₹200 applies
    expect(
      maxAllowedBid({ lowestPricePaise: 5_000_000, minStepPaise: 20_000, minStepBps: 25 }),
    ).toEqual({
      maxPaise: 4_980_000,
      stepPaise: 20_000,
    });
    // 0.25% of ₹10,00,000 = ₹2,500 → ₹2,500 applies
    expect(
      maxAllowedBid({ lowestPricePaise: 100_000_000, minStepPaise: 20_000, minStepBps: 25 }),
    ).toEqual({
      maxPaise: 99_750_000,
      stepPaise: 250_000,
    });
  });
});

describe('placeBid', () => {
  it('saves a valid first bid and swaps the lowest price atomically', async () => {
    const group = liveGroup();
    given({ group });
    const result = await placeBid(String(group._id), dealerUser, priced(8_500_000), { now: NOW });
    expect(result).toMatchObject({ rank: 1, lowestPricePaise: 8_500_000, extended: false });
    // Compare-and-set on the lowest bid and end time we read
    const [filter, update] = casWrite.mock.calls[0];
    expect(filter).toMatchObject({ status: S.AUCTION_LIVE, 'auction.lowestBidId': null });
    expect(update.$set['auction.lowestPricePaise']).toBe(8_500_000);
    expect(update.$inc).toMatchObject({ 'auction.bidCount': 1, 'auction.dealerCount': 1 });
  });

  it('rejects a breakdown that does not add up (422)', async () => {
    const group = liveGroup();
    given({ group });
    const input = { pricePerUnitPaise: 8_500_000, breakdown: { basePaise: 8_000_000 } };
    await expect(
      placeBid(String(group._id), dealerUser, input, { now: NOW }),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'BREAKDOWN_MISMATCH',
    });
    expect(casWrite).not.toHaveBeenCalled();
  });

  it('rejects a first bid at or above the ceiling', async () => {
    const group = liveGroup();
    given({ group });
    await expect(
      placeBid(String(group._id), dealerUser, priced(9_000_000), { now: NOW }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ABOVE_CEILING' });
  });

  it('rejects a bid that does not beat the lowest by the minimum step', async () => {
    const group = liveGroup({ lowestPricePaise: 8_000_000, lowestBidId: new Types.ObjectId() });
    given({ group });
    // ₹200 step → at most ₹79,800; ₹79,900 is too high
    await expect(
      placeBid(String(group._id), dealerUser, priced(7_990_000), { now: NOW }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'BID_TOO_HIGH' });
  });

  it('when two bids race, only one wins: the loser gets BID_RACE (409)', async () => {
    const group = liveGroup({ lowestPricePaise: 8_000_000, lowestBidId: new Types.ObjectId() });
    given({ group, cas: null }); // someone else changed the lowest first
    await expect(
      placeBid(String(group._id), dealerUser, priced(7_900_000), { now: NOW }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'BID_RACE' });
  });

  it('a bid in the last 5 minutes extends the timer by 5 minutes', async () => {
    const endsAt = new Date(NOW.getTime() + 2 * MIN);
    const group = liveGroup({ endsAt });
    given({ group });
    const result = await placeBid(String(group._id), dealerUser, priced(8_500_000), { now: NOW });
    expect(result.extended).toBe(true);
    expect(casWrite.mock.calls[0][1].$set['auction.endsAt']).toEqual(
      new Date(endsAt.getTime() + 5 * MIN),
    );
    expect(casWrite.mock.calls[0][1].$inc['auction.extensions']).toBe(1);
    expect(scheduleAuctionClose).toHaveBeenCalled();
  });

  it('stops extending after 6 extensions', async () => {
    const group = liveGroup({ endsAt: new Date(NOW.getTime() + 2 * MIN), extensions: 6 });
    given({ group });
    const result = await placeBid(String(group._id), dealerUser, priced(8_500_000), { now: NOW });
    expect(result.extended).toBe(false);
    expect(casWrite.mock.calls[0][1].$set['auction.endsAt']).toBeUndefined();
  });

  it('tells the dealer who was outbid', async () => {
    const group = liveGroup({ lowestPricePaise: 8_000_000, lowestBidId: new Types.ObjectId() });
    given({ group });
    await placeBid(String(group._id), dealerUser, priced(7_900_000), { now: NOW });
    expect(notifyDealer).toHaveBeenCalledWith(
      otherSeller,
      'dealer_outbid',
      expect.objectContaining({ price: expect.any(String) }),
      expect.any(Function),
    );
  });

  it('dealers must join (accept the commitment) first', async () => {
    const group = liveGroup();
    given({ group, dealer: null });
    await expect(
      placeBid(String(group._id), dealerUser, priced(8_500_000), { now: NOW }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'NOT_JOINED' });
  });

  it('suspended or low-rated dealers cannot bid; unrated verified dealers can', async () => {
    const group = liveGroup();
    given({ group, seller: verifiedSeller({ rating: 3.2, ratingCount: 5 }) });
    await expect(
      placeBid(String(group._id), dealerUser, priced(8_500_000), { now: NOW }),
    ).rejects.toMatchObject({ code: 'RATING_TOO_LOW' });

    jest.restoreAllMocks();
    given({ group, seller: verifiedSeller({ rating: 2, ratingCount: 2 }) }); // unrated (< 3 reviews)
    await expect(
      placeBid(String(group._id), dealerUser, priced(8_500_000), { now: NOW }),
    ).resolves.toMatchObject({ rank: 1 });
  });

  it('refuses bids after the auction ended or while paused', async () => {
    const ended = liveGroup({ endsAt: new Date(NOW.getTime() - 1) });
    given({ group: ended });
    await expect(
      placeBid(String(ended._id), dealerUser, priced(8_500_000), { now: NOW }),
    ).rejects.toMatchObject({ code: 'AUCTION_CLOSED' });

    jest.restoreAllMocks();
    const paused = liveGroup({ pausedAt: NOW });
    given({ group: paused });
    await expect(
      placeBid(String(paused._id), dealerUser, priced(8_500_000), { now: NOW }),
    ).rejects.toMatchObject({ code: 'AUCTION_PAUSED' });
  });
});
