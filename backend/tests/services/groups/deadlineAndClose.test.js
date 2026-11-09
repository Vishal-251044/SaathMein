/**
 * Deadline sweep (GRP-5, GRP-8) and auction close (AUC-5): a test group expires at its
 * deadline (Day 6 "Done when"), ≥70% opens the leader's 48 h window, an unanswered window
 * expires, seller-led deals close at their deadline (refund all below tier 1, decided
 * 8 Nov 2026), and auction close: lowest / earliest / runner-up, minimum-dealers
 * extension, no bids, single dealer → leader decides.
 */
jest.mock('../../../src/services/groups/groupEffects', () => ({ runGroupEffects: jest.fn() }));
jest.mock('../../../src/jobs/queues', () => ({ scheduleAuctionClose: jest.fn() }));
jest.mock('../../../src/services/settings.service', () => ({
  getGroupSettings: jest.fn(async () => ({
    earlyStartThresholdBps: 7000,
    leaderDecisionHours: 48,
    extensionDays: 7,
    maxOpenGroupsPerLeader: 5,
  })),
  getAuctionSettings: jest.fn(async () => ({
    minDealerExtensionHours: 24,
    singleBidDecisionHours: 24,
    exitWindowHours: 24,
  })),
}));
jest.mock('../../../src/services/groups/groupLive', () => ({
  notifyAboutGroup: jest.fn(),
  notifyGroupMembers: jest.fn(),
}));
jest.mock('../../../src/sockets/emitter', () => ({
  emitToAuction: jest.fn(),
  emitToGroup: jest.fn(),
}));
jest.mock('../../../src/services/lock.service', () => ({
  withLock: jest.fn(async (key, ttl, fn) => ({ acquired: true, result: await fn() })),
}));
jest.mock('../../../src/services/auction/winner.service', () => ({ declareWinner: jest.fn() }));
jest.mock('../../../src/services/auction/auction.service', () => ({
  auctionRulesFor: jest.fn(async () => ({ minDealers: 2 })),
  notifyEligibleDealers: jest.fn(),
}));
jest.mock('../../../src/services/deals/deal.service', () => ({ closeSellerDeal: jest.fn() }));

const { Types } = require('mongoose');
const Group = require('../../../src/models/group.model');
const Bid = require('../../../src/models/bid.model');
const { processDeadlines } = require('../../../src/services/groups/deadline.service');
const { scheduleAuctionClose } = require('../../../src/jobs/queues');
const { pickWinners, closeAuction } = require('../../../src/services/auction/auctionClose.service');
const { declareWinner } = require('../../../src/services/auction/winner.service');
const { closeSellerDeal } = require('../../../src/services/deals/deal.service');
const { notifyAboutGroup } = require('../../../src/services/groups/groupLive');
const { GROUP_STATUS: S, GROUP_TYPE } = require('../../../src/constants/enums');

const NOW = new Date('2026-11-05T10:00:00Z');
const HOUR = 3600_000;

const openGroup = (overrides = {}) => ({
  _id: new Types.ObjectId(),
  type: GROUP_TYPE.BUYER_LED,
  status: S.OPEN,
  targetSize: 10,
  memberCount: 0,
  deadline: new Date(NOW.getTime() - 1000),
  ...overrides,
});

/** find() order in the sweep: buyer-led due, seller-led deals due, leader window passed. */
const givenGroups = (due, undecided = [], deals = []) =>
  jest
    .spyOn(Group, 'find')
    .mockReturnValueOnce({ limit: async () => due })
    .mockReturnValueOnce({ limit: async () => deals })
    .mockReturnValueOnce({ limit: async () => undecided });

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('processDeadlines', () => {
  it('expires a group below 70% at its deadline', async () => {
    const group = openGroup({ memberCount: 6 });
    givenGroups([group]);
    const write = jest
      .spyOn(Group, 'findOneAndUpdate')
      .mockResolvedValue({ ...group, status: S.EXPIRED });

    expect(await processDeadlines(NOW)).toEqual({ expired: 1, awaitingLeader: 0 });
    expect(write.mock.calls[0][1].$set.status).toBe(S.EXPIRED);
    expect(write.mock.calls[0][1].$push.statusHistory.reason).toBe('deadline_passed');
  });

  it('expires an empty group (nobody paid)', async () => {
    givenGroups([openGroup({ targetSize: 2, memberCount: 0 })]);
    jest.spyOn(Group, 'findOneAndUpdate').mockResolvedValue({ status: S.EXPIRED });
    expect((await processDeadlines(NOW)).expired).toBe(1);
  });

  it('gives the leader 48 h to choose at ≥70%', async () => {
    const group = openGroup({ memberCount: 7 });
    givenGroups([group]);
    const update = jest.spyOn(Group, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
    const write = jest.spyOn(Group, 'findOneAndUpdate');

    expect(await processDeadlines(NOW)).toEqual({ expired: 0, awaitingLeader: 1 });
    expect(update.mock.calls[0][1].$set.leaderDecisionDueAt).toEqual(
      new Date(NOW.getTime() + 48 * HOUR),
    );
    expect(write).not.toHaveBeenCalled(); // still open
  });

  it('expires when the leader did not choose in time', async () => {
    const group = openGroup({ memberCount: 8, leaderDecisionDueAt: new Date(NOW.getTime() - 1) });
    givenGroups([], [group]);
    const write = jest.spyOn(Group, 'findOneAndUpdate').mockResolvedValue({ status: S.EXPIRED });
    expect((await processDeadlines(NOW)).expired).toBe(1);
    expect(write.mock.calls[0][1].$push.statusHistory.reason).toBe('leader_decision_timeout');
  });

  it('ignores a group another process already moved', async () => {
    givenGroups([openGroup()]);
    jest.spyOn(Group, 'findOneAndUpdate').mockResolvedValue(null);
    expect(await processDeadlines(NOW)).toEqual({ expired: 0, awaitingLeader: 0 });
  });
});

describe('seller-led deals at their deadline (AUC-9)', () => {
  const deal = (memberCount) =>
    openGroup({
      type: GROUP_TYPE.SELLER_LED,
      memberCount,
      targetSize: 20,
      tiers: [
        { size: 5, discountBps: 300 },
        { size: 10, discountBps: 600 },
        { size: 20, discountBps: 1000 },
      ],
    });

  it('wins at the tier reached when tier 1 was reached', async () => {
    const group = deal(7);
    givenGroups([], [], [group]);
    expect(await processDeadlines(NOW)).toEqual({ expired: 0, awaitingLeader: 0 });
    expect(closeSellerDeal).toHaveBeenCalledWith(group, 'deadline_tier_reached');
  });

  it('expires (refund all) below the first tier — open question 4', async () => {
    givenGroups([], [], [deal(4)]);
    const write = jest.spyOn(Group, 'findOneAndUpdate').mockResolvedValue({ status: S.EXPIRED });
    expect((await processDeadlines(NOW)).expired).toBe(1);
    expect(closeSellerDeal).not.toHaveBeenCalled();
    expect(write.mock.calls[0][1].$push.statusHistory.reason).toBe('deadline_first_tier_missed');
  });
});

describe('auction close', () => {
  const sellerA = new Types.ObjectId();
  const sellerB = new Types.ObjectId();
  const bid = (sellerId, price, minute) => ({
    _id: new Types.ObjectId(),
    sellerId,
    pricePerUnitPaise: price,
    createdAt: new Date(NOW.getTime() + minute * 60_000),
  });
  const liveGroup = (endsAt, auction = {}) =>
    openGroup({ status: S.AUCTION_LIVE, memberCount: 10, auction: { endsAt, ...auction } });
  const givenBids = (bids) =>
    jest
      .spyOn(Bid, 'find')
      .mockReturnValue({ sort: () => ({ limit: () => ({ lean: async () => bids }) }) });

  it('lowest wins, earliest wins a tie, runner-up is another dealer', () => {
    const first = bid(sellerA, 7_500_000, 1);
    const tieLater = bid(sellerB, 7_500_000, 2);
    const sameDealer = bid(sellerA, 7_600_000, 3);
    // Sorted by price, then time, as the query returns them
    const { winner, runnerUp } = pickWinners([first, tieLater, sameDealer]);
    expect(winner).toBe(first);
    expect(runnerUp).toBe(tieLater);
    expect(pickWinners([first, sameDealer]).runnerUp).toBeNull();
    expect(pickWinners([])).toEqual({ winner: null, runnerUp: null });
  });

  it('waits when the auction was extended after the job was queued', async () => {
    jest
      .spyOn(Group, 'findById')
      .mockResolvedValue(liveGroup(new Date(NOW.getTime() + 5 * 60_000)));
    expect(await closeAuction('g1', NOW)).toEqual({ outcome: 'rescheduled' });
    expect(scheduleAuctionClose).toHaveBeenCalled();
  });

  it('skips groups that are no longer live (runs once)', async () => {
    jest.spyOn(Group, 'findById').mockResolvedValue(openGroup({ status: S.WON }));
    expect(await closeAuction('g1', NOW)).toEqual({ outcome: 'skipped' });
  });

  it('does nothing while waiting for the leader (already closed)', async () => {
    jest
      .spyOn(Group, 'findById')
      .mockResolvedValue(liveGroup(new Date(NOW.getTime() - 1), { closedAt: NOW }));
    expect(await closeAuction('g1', NOW)).toEqual({ outcome: 'skipped' });
  });

  it('extends once by 24 h when fewer than 2 dealers bid', async () => {
    jest.spyOn(Group, 'findById').mockResolvedValue(liveGroup(new Date(NOW.getTime() - 1)));
    givenBids([bid(sellerA, 7_400_000, 1)]);
    const write = jest
      .spyOn(Group, 'findOneAndUpdate')
      .mockResolvedValue({ _id: 'g1', auction: { extensions: 0 } });
    expect(await closeAuction('g1', NOW)).toEqual({ outcome: 'extended' });
    expect(write.mock.calls[0][1].$set).toEqual({
      'auction.endsAt': new Date(NOW.getTime() + 24 * HOUR),
      'auction.minDealerExtensionUsed': true,
    });
    expect(scheduleAuctionClose).toHaveBeenCalled();
    expect(declareWinner).not.toHaveBeenCalled();
  });

  it('ends with no_deal when nobody bid after the extension', async () => {
    jest
      .spyOn(Group, 'findById')
      .mockResolvedValue(liveGroup(new Date(NOW.getTime() - 1), { minDealerExtensionUsed: true }));
    givenBids([]);
    const write = jest.spyOn(Group, 'findOneAndUpdate').mockResolvedValue({ status: S.NO_DEAL });
    expect(await closeAuction('g1', NOW)).toEqual({ outcome: 'no_deal' });
    expect(write.mock.calls[0][1].$set.status).toBe(S.NO_DEAL);
  });

  it('still one dealer after the extension: the leader gets 24 h to decide', async () => {
    jest
      .spyOn(Group, 'findById')
      .mockResolvedValue(liveGroup(new Date(NOW.getTime() - 1), { minDealerExtensionUsed: true }));
    givenBids([bid(sellerA, 7_300_000, 3), bid(sellerA, 7_400_000, 1)]);
    const update = jest.spyOn(Group, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
    expect(await closeAuction('g1', NOW)).toEqual({ outcome: 'awaiting_leader' });
    expect(update.mock.calls[0][1].$set).toEqual({
      'auction.closedAt': NOW,
      'auction.singleBidDecisionDueAt': new Date(NOW.getTime() + 24 * HOUR),
    });
    expect(notifyAboutGroup).toHaveBeenCalled();
    expect(declareWinner).not.toHaveBeenCalled();
  });

  it('declares the lowest bid the winner with the runner-up from another dealer', async () => {
    const group = liveGroup(new Date(NOW.getTime() - 1));
    const winner = bid(sellerA, 7_400_000, 1);
    const runnerUp = bid(sellerB, 7_450_000, 2);
    jest.spyOn(Group, 'findById').mockResolvedValue(group);
    givenBids([winner, runnerUp]);
    expect(await closeAuction(String(group._id), NOW)).toEqual({ outcome: 'won' });
    expect(declareWinner).toHaveBeenCalledWith(group, winner, runnerUp, {
      reason: 'lowest_bid_won',
    });
  });
});
