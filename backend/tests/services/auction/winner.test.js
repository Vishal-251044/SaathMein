/**
 * Auction results (AUC-8, PRD §10.5): the winner gets the group with a 24 h exit window and
 * every member gets a deal code; a winner backing out is penalised and the runner-up is
 * offered the group (or it is cancelled with refunds); the runner-up accepts or declines;
 * unanswered single-dealer decisions cancel and unanswered runner-up offers end in no_deal.
 */
jest.mock('../../../src/services/groups/stateMachine', () => ({
  transition: jest.fn(async (group, to, options) => ({ ...group, status: to, ...options?.set })),
}));
jest.mock('../../../src/services/groups/groupLive', () => ({
  notifyGroupMembers: jest.fn(),
  groupUrl: jest.fn(),
}));
jest.mock('../../../src/services/notifications/notification.service', () => ({
  notifyUsers: jest.fn(),
}));
jest.mock('../../../src/services/email.service', () => ({
  sendRunnerUpOffer: jest.fn(),
  sendAuctionResult: jest.fn(),
}));
jest.mock('../../../src/sockets/emitter', () => ({ emitToAuction: jest.fn() }));
jest.mock('../../../src/services/auction/dealCode.service', () => ({
  issueDealCodes: jest.fn(async () => 5),
  clearDealCodes: jest.fn(),
}));
jest.mock('../../../src/services/trust/penalty.service', () => ({
  applyPenalties: jest.fn(async () => 2),
}));
jest.mock('../../../src/services/auction/settlement.service', () => ({
  holdGroupTransfersSafe: jest.fn(),
  reverseGroupTransfers: jest.fn(async () => ({ reversed: 0, failed: 0 })),
}));
jest.mock('../../../src/services/settings.service', () => ({
  getAuctionSettings: jest.fn(async () => ({
    exitWindowHours: 24,
    runnerUpOfferHours: 24,
    backOutSuspensionDays: 30,
  })),
}));

const { Types } = require('mongoose');
const Group = require('../../../src/models/group.model');
const Bid = require('../../../src/models/bid.model');
const Seller = require('../../../src/models/seller.model');
const SellerStaff = require('../../../src/models/sellerStaff.model');
const AuctionDealer = require('../../../src/models/auctionDealer.model');
const Product = require('../../../src/models/product.model');
const { transition } = require('../../../src/services/groups/stateMachine');
const settlement = require('../../../src/services/auction/settlement.service');
const { applyPenalties } = require('../../../src/services/trust/penalty.service');
const {
  issueDealCodes,
  clearDealCodes,
} = require('../../../src/services/auction/dealCode.service');
const {
  declareWinner,
  backOut,
  respondToRunnerUpOffer,
  processAuctionTimeouts,
} = require('../../../src/services/auction/winner.service');
const { GROUP_STATUS: S } = require('../../../src/constants/enums');

const HOUR = 3600_000;
const sellerA = new Types.ObjectId();
const sellerB = new Types.ObjectId();
const userId = String(new Types.ObjectId());
const bid = (sellerId, price) => ({
  _id: new Types.ObjectId(),
  sellerId,
  pricePerUnitPaise: price,
});
const lean = (value) => ({ lean: async () => value });

beforeEach(() => {
  jest.spyOn(Bid, 'updateOne').mockResolvedValue({});
  jest.spyOn(Bid, 'updateMany').mockResolvedValue({});
  jest.spyOn(AuctionDealer, 'updateOne').mockResolvedValue({});
  jest.spyOn(AuctionDealer, 'updateMany').mockResolvedValue({});
  jest
    .spyOn(AuctionDealer, 'find')
    .mockReturnValue({ select: () => lean([{ sellerId: sellerA }]) });
  jest.spyOn(Seller, 'updateOne').mockResolvedValue({});
  jest.spyOn(Seller, 'findById').mockReturnValue({
    select: () => lean({ _id: sellerA, businessName: 'Pune Motors', contactEmail: 'a@b.in' }),
  });
  jest.spyOn(SellerStaff, 'find').mockReturnValue({ select: () => lean([]) });
  jest.spyOn(Product, 'findById').mockReturnValue({
    select: () => lean({ brand: 'Honda', model: 'Activa' }),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('declareWinner', () => {
  it('moves the group to won with price, 24 h exit window and deal codes', async () => {
    const group = { _id: new Types.ObjectId(), status: S.AUCTION_LIVE, auction: {} };
    const winner = bid(sellerA, 7_400_000);
    const runnerUp = bid(sellerB, 7_450_000);
    const before = Date.now();

    await declareWinner(group, winner, runnerUp, { reason: 'lowest_bid_won' });

    const [, to, options] = transition.mock.calls[0];
    expect(to).toBe(S.WON);
    expect(options.set).toMatchObject({
      sellerId: sellerA,
      winningPricePaise: 7_400_000,
      'auction.winnerBidId': winner._id,
      'auction.runnerUpBidId': runnerUp._id,
    });
    const exit = options.set.exitWindowEndsAt.getTime();
    expect(exit).toBeGreaterThanOrEqual(before + 24 * HOUR);
    expect(exit).toBeLessThan(before + 24 * HOUR + 60_000);
    expect(Bid.updateOne).toHaveBeenCalledWith({ _id: winner._id }, { $set: { status: 'won' } });
    expect(Bid.updateOne).toHaveBeenCalledWith(
      { _id: runnerUp._id },
      { $set: { status: 'runner_up' } },
    );
    expect(issueDealCodes).toHaveBeenCalledWith(group._id);
    // Tokens go to the dealer on hold (PAY-4)
    expect(settlement.holdGroupTransfersSafe).toHaveBeenCalledWith(group._id);
  });
});

describe('backOut', () => {
  const wonGroup = (auction = {}) => ({
    _id: new Types.ObjectId(),
    status: S.WON,
    sellerId: sellerA,
    productId: new Types.ObjectId(),
    auction,
  });

  it('only the winner may back out', async () => {
    jest.spyOn(Group, 'findById').mockResolvedValue(wonGroup());
    await expect(
      backOut('g', { sellerId: String(sellerB), userId }, 'stock ran out at the showroom'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('penalises the winner and offers the group to the runner-up for 24 h', async () => {
    const runnerUp = bid(sellerB, 7_450_000);
    jest.spyOn(Group, 'findById').mockResolvedValue(wonGroup({ runnerUpBidId: runnerUp._id }));
    jest.spyOn(Bid, 'findById').mockReturnValue(lean(runnerUp));

    await backOut('g', { sellerId: String(sellerA), userId }, 'stock ran out at the showroom');

    expect(applyPenalties).toHaveBeenCalledWith(
      String(sellerA),
      ['rating_penalty', 'auction_suspension'],
      expect.objectContaining({ reason: 'stock ran out at the showroom', suspensionDays: 30 }),
    );
    expect(clearDealCodes).toHaveBeenCalled();
    expect(settlement.reverseGroupTransfers).toHaveBeenCalledWith('g', 'dealer_backed_out');
    const [, to, options] = transition.mock.calls[0];
    expect(to).toBe(S.RUNNER_UP);
    expect(options.ctx.runnerUpBidId).toBe(runnerUp._id);
    expect(options.set['auction.runnerUpOfferDueAt']).toBeInstanceOf(Date);
  });

  it('without a runner-up the group is cancelled (full refunds)', async () => {
    jest.spyOn(Group, 'findById').mockResolvedValue(wonGroup());
    await backOut('g', { sellerId: String(sellerA), userId }, 'stock ran out at the showroom');
    expect(transition.mock.calls[0][1]).toBe(S.CANCELLED);
  });

  it('cannot back out once purchasing started', async () => {
    jest.spyOn(Group, 'findById').mockResolvedValue({ ...wonGroup(), status: S.PURCHASING });
    await expect(
      backOut('g', { sellerId: String(sellerA), userId }, 'stock ran out at the showroom'),
    ).rejects.toMatchObject({ code: 'CANNOT_BACK_OUT' });
  });
});

describe('respondToRunnerUpOffer', () => {
  const runnerUp = bid(sellerB, 7_450_000);
  const offered = () => ({
    _id: new Types.ObjectId(),
    status: S.RUNNER_UP,
    productId: new Types.ObjectId(),
    auction: { runnerUpBidId: runnerUp._id },
  });

  it('accepting moves to purchasing at the runner-up price with new deal codes', async () => {
    jest.spyOn(Group, 'findById').mockResolvedValue(offered());
    jest.spyOn(Bid, 'findById').mockReturnValue(lean(runnerUp));
    await respondToRunnerUpOffer('g', { sellerId: String(sellerB), userId }, true);
    const [, to, options] = transition.mock.calls[0];
    expect(to).toBe(S.PURCHASING);
    expect(options.set).toMatchObject({ sellerId: String(sellerB), winningPricePaise: 7_450_000 });
    expect(issueDealCodes).toHaveBeenCalled();
  });

  it('declining ends with no_deal (full refunds)', async () => {
    jest.spyOn(Group, 'findById').mockResolvedValue(offered());
    jest.spyOn(Bid, 'findById').mockReturnValue(lean(runnerUp));
    await respondToRunnerUpOffer('g', { sellerId: String(sellerB), userId }, false);
    expect(transition.mock.calls[0][1]).toBe(S.NO_DEAL);
  });

  it('another dealer cannot answer the offer', async () => {
    jest.spyOn(Group, 'findById').mockResolvedValue(offered());
    jest.spyOn(Bid, 'findById').mockReturnValue(lean(runnerUp));
    await expect(
      respondToRunnerUpOffer('g', { sellerId: String(sellerA), userId }, true),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('processAuctionTimeouts', () => {
  it('cancels unanswered single-dealer results and ends unanswered runner-up offers', async () => {
    jest
      .spyOn(Group, 'find')
      .mockReturnValueOnce({ limit: async () => [{ _id: 'a', status: S.AUCTION_LIVE }] })
      .mockReturnValueOnce({ limit: async () => [{ _id: 'b', status: S.RUNNER_UP }] });
    expect(await processAuctionTimeouts(new Date())).toEqual({ cancelled: 1, noDeal: 1 });
    expect(transition.mock.calls[0][1]).toBe(S.CANCELLED);
    expect(transition.mock.calls[0][2].reason).toBe('single_bid_no_answer');
    expect(transition.mock.calls[1][1]).toBe(S.NO_DEAL);
  });
});
