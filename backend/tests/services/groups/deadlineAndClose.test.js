/**
 * Deadline sweep (GRP-5, GRP-8) and auction close (AUC-5): a test group expires at its
 * deadline (Day 6 "Done when"), ≥70% opens the leader's 48 h window, an unanswered window
 * expires, and auction close picks lowest / earliest / runner-up from another dealer.
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
}));

const { Types } = require('mongoose');
const Group = require('../../../src/models/group.model');
const Bid = require('../../../src/models/bid.model');
const { processDeadlines } = require('../../../src/services/groups/deadline.service');
const { scheduleAuctionClose } = require('../../../src/jobs/queues');
const { pickWinners, closeAuction } = require('../../../src/services/auction/auctionClose.service');
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

afterEach(() => jest.restoreAllMocks());

describe('processDeadlines', () => {
  /** First find() = deadline due, second = leader window passed. */
  const givenGroups = (due, undecided = []) =>
    jest
      .spyOn(Group, 'find')
      .mockReturnValueOnce({ limit: async () => due })
      .mockReturnValueOnce({ limit: async () => undecided });

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

describe('auction close', () => {
  const sellerA = new Types.ObjectId();
  const sellerB = new Types.ObjectId();
  const bid = (sellerId, price, minute) => ({
    _id: new Types.ObjectId(),
    sellerId,
    pricePerUnitPaise: price,
    createdAt: new Date(NOW.getTime() + minute * 60_000),
  });

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

  const liveGroup = (endsAt) =>
    openGroup({ status: S.AUCTION_LIVE, memberCount: 10, auction: { endsAt } });

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

  it('ends with no_deal when nobody bid', async () => {
    jest.spyOn(Group, 'findById').mockResolvedValue(liveGroup(new Date(NOW.getTime() - 1)));
    jest
      .spyOn(Bid, 'find')
      .mockReturnValue({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) });
    const write = jest.spyOn(Group, 'findOneAndUpdate').mockResolvedValue({ status: S.NO_DEAL });
    expect(await closeAuction('g1', NOW)).toEqual({ outcome: 'no_deal' });
    expect(write.mock.calls[0][1].$set.status).toBe(S.NO_DEAL);
  });

  it('declares the lowest bid the winner and marks the other bids', async () => {
    const group = liveGroup(new Date(NOW.getTime() - 1));
    const winner = bid(sellerA, 7_400_000, 1);
    const runnerUp = bid(sellerB, 7_450_000, 2);
    jest.spyOn(Group, 'findById').mockResolvedValue(group);
    jest.spyOn(Bid, 'find').mockReturnValue({
      sort: () => ({ limit: () => ({ lean: async () => [winner, runnerUp] }) }),
    });
    const write = jest.spyOn(Group, 'findOneAndUpdate').mockResolvedValue({ status: S.WON });
    const bidUpdate = jest.spyOn(Bid, 'updateOne').mockResolvedValue({});
    jest.spyOn(Bid, 'updateMany').mockResolvedValue({});

    expect(await closeAuction(String(group._id), NOW)).toEqual({ outcome: 'won' });
    const { $set } = write.mock.calls[0][1];
    expect($set).toMatchObject({
      status: S.WON,
      sellerId: sellerA,
      'auction.winnerBidId': winner._id,
      'auction.runnerUpBidId': runnerUp._id,
      'auction.lowestPricePaise': 7_400_000,
    });
    expect(bidUpdate).toHaveBeenCalledWith({ _id: winner._id }, { $set: { status: 'won' } });
    expect(bidUpdate).toHaveBeenCalledWith(
      { _id: runnerUp._id },
      { $set: { status: 'runner_up' } },
    );
  });
});
