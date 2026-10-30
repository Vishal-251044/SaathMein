/**
 * Group state machine (GRP-8, Day 6 "Tests: every state transition"): the full transition
 * matrix, every guard, the optimistic lock, side effects, and the model refusing status
 * writes that bypass the state machine.
 */
jest.mock('../../../src/services/groups/groupEffects', () => ({ runGroupEffects: jest.fn() }));

const { Types } = require('mongoose');
const Group = require('../../../src/models/group.model');
const { runGroupEffects } = require('../../../src/services/groups/groupEffects');
const {
  TRANSITIONS,
  canTransition,
  assertTransition,
  transition,
  earlyStartMinimum,
} = require('../../../src/services/groups/stateMachine');
const { GROUP_STATUS: S, GROUP_TYPE } = require('../../../src/constants/enums');

const ALL = Object.values(S);
const PAST = new Date(Date.now() - 60_000);
const FUTURE = new Date(Date.now() + 86_400_000);

/** Group shaped for guards. */
const group = (overrides = {}) => ({
  _id: new Types.ObjectId(),
  type: GROUP_TYPE.BUYER_LED,
  status: S.OPEN,
  memberCount: 0,
  targetSize: 10,
  deadline: FUTURE,
  auction: {},
  ...overrides,
});

const EXPECTED_EDGES = {
  open: ['full', 'auction_live', 'expired', 'cancelled'],
  full: ['auction_live', 'won', 'cancelled'],
  auction_live: ['won', 'no_deal', 'cancelled'],
  won: ['purchasing', 'cancelled'],
  purchasing: ['completed', 'runner_up', 'cancelled'],
  runner_up: ['purchasing', 'no_deal', 'cancelled'],
  completed: [],
  expired: [],
  no_deal: [],
  cancelled: [],
};

describe('transition matrix', () => {
  it('defines every status', () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual([...ALL].sort());
  });

  // All 100 pairs: allowed exactly when listed
  ALL.forEach((from) => {
    ALL.forEach((to) => {
      const allowed = EXPECTED_EDGES[from].includes(to);
      it(`${from} → ${to} is ${allowed ? 'allowed' : 'refused'}`, () => {
        expect(canTransition(from, to)).toBe(allowed);
        if (!allowed) {
          expect(() => assertTransition(group({ status: from }), to, { reason: 'x' })).toThrow(
            expect.objectContaining({ code: 'INVALID_TRANSITION', statusCode: 409 }),
          );
        }
      });
    });
  });
});

describe('guards', () => {
  const blocked = (g, to, ctx) =>
    expect(() => assertTransition(g, to, ctx)).toThrow(
      expect.objectContaining({ code: 'TRANSITION_BLOCKED' }),
    );
  const passes = (g, to, ctx) => expect(() => assertTransition(g, to, ctx)).not.toThrow();

  it('open → full needs the target reached', () => {
    blocked(group({ memberCount: 9 }), S.FULL);
    passes(group({ memberCount: 10 }), S.FULL);
  });

  it('open → expired only after the deadline', () => {
    blocked(group(), S.EXPIRED);
    passes(group({ deadline: PAST }), S.EXPIRED);
  });

  it('open → auction_live (early start) needs the deadline passed and ≥70%, buyer-led', () => {
    const ctx = { thresholdBps: 7000 };
    blocked(group({ memberCount: 7 }), S.AUCTION_LIVE, ctx); // deadline not passed
    blocked(group({ memberCount: 6, deadline: PAST }), S.AUCTION_LIVE, ctx);
    passes(group({ memberCount: 7, deadline: PAST }), S.AUCTION_LIVE, ctx);
    blocked(group({ memberCount: 7, deadline: PAST }), S.AUCTION_LIVE, {}); // threshold missing
    blocked(
      group({ memberCount: 7, deadline: PAST, type: GROUP_TYPE.SELLER_LED }),
      S.AUCTION_LIVE,
      ctx,
    );
  });

  it('full → auction_live is buyer-led only; full → won is seller-led only', () => {
    passes(group({ status: S.FULL }), S.AUCTION_LIVE);
    blocked(group({ status: S.FULL, type: GROUP_TYPE.SELLER_LED }), S.AUCTION_LIVE);
    passes(group({ status: S.FULL, type: GROUP_TYPE.SELLER_LED }), S.WON);
    blocked(group({ status: S.FULL }), S.WON);
  });

  it('auction_live → won needs a winning bid; → no_deal does not', () => {
    blocked(group({ status: S.AUCTION_LIVE }), S.WON);
    passes(group({ status: S.AUCTION_LIVE }), S.WON, { winnerBidId: 'b1' });
    passes(group({ status: S.AUCTION_LIVE }), S.NO_DEAL);
  });

  it('won → purchasing, purchasing → completed and runner_up paths', () => {
    passes(group({ status: S.WON }), S.PURCHASING);
    passes(group({ status: S.PURCHASING }), S.COMPLETED);
    blocked(group({ status: S.PURCHASING }), S.RUNNER_UP);
    passes(group({ status: S.PURCHASING, auction: { runnerUpBidId: 'b2' } }), S.RUNNER_UP);
    passes(group({ status: S.RUNNER_UP }), S.PURCHASING);
    passes(group({ status: S.RUNNER_UP }), S.NO_DEAL);
  });

  it('cancelling always needs a reason', () => {
    ['open', 'full', 'auction_live', 'won', 'purchasing', 'runner_up'].forEach((status) => {
      expect(() => assertTransition(group({ status }), S.CANCELLED, {})).toThrow(
        expect.objectContaining({ code: 'REASON_REQUIRED' }),
      );
      passes(group({ status }), S.CANCELLED, { reason: 'fraud' });
    });
  });

  it('computes the early-start minimum with rounding up', () => {
    expect(earlyStartMinimum(10, 7000)).toBe(7);
    expect(earlyStartMinimum(20, 7000)).toBe(14);
    expect(earlyStartMinimum(5, 7000)).toBe(4); // 3.5 → 4
    expect(earlyStartMinimum(2, 7000)).toBe(2);
  });
});

describe('transition()', () => {
  afterEach(() => jest.restoreAllMocks());

  it('writes with the current status as a lock and records history, then runs effects', async () => {
    const g = group({ deadline: PAST });
    const spy = jest
      .spyOn(Group, 'findOneAndUpdate')
      .mockResolvedValue({ ...g, status: S.EXPIRED });

    await transition(g, S.EXPIRED, { reason: 'deadline_passed' });

    const [filter, update, options] = spy.mock.calls[0];
    expect(filter).toEqual({ _id: g._id, status: S.OPEN });
    expect(update.$set.status).toBe(S.EXPIRED);
    expect(update.$push.statusHistory).toMatchObject({
      from: S.OPEN,
      to: S.EXPIRED,
      reason: 'deadline_passed',
      byType: 'system',
    });
    expect(options.stateMachine).toBe(true);
    expect(runGroupEffects).toHaveBeenCalledWith(
      expect.objectContaining({ status: S.EXPIRED }),
      S.OPEN,
    );
  });

  it('refuses when someone else changed the status first (exactly once)', async () => {
    jest.spyOn(Group, 'findOneAndUpdate').mockResolvedValue(null);
    await expect(
      transition(group({ deadline: PAST }), S.EXPIRED, { reason: 'x' }),
    ).rejects.toMatchObject({
      code: 'GROUP_CHANGED',
    });
  });

  it('skips effects inside a transaction (run after commit)', async () => {
    runGroupEffects.mockClear();
    jest.spyOn(Group, 'findOneAndUpdate').mockResolvedValue({ status: S.FULL });
    await transition(group({ memberCount: 10 }), S.FULL, { reason: 'target_reached', session: {} });
    expect(runGroupEffects).not.toHaveBeenCalled();
  });
});

describe('model guard', () => {
  it('refuses saving a status change outside the state machine', async () => {
    const doc = new Group({
      type: GROUP_TYPE.BUYER_LED,
      productId: new Types.ObjectId(),
      categoryId: new Types.ObjectId(),
      cityId: new Types.ObjectId(),
      targetSize: 10,
      tokenAmountPaise: 100000,
      deadline: FUTURE,
    });
    doc.isNew = false;
    doc.status = S.WON;
    await expect(doc.save()).rejects.toThrow('state machine');
  });

  it('refuses updates that touch status without the state machine flag', async () => {
    await expect(Group.updateOne({}, { $set: { status: S.WON } })).rejects.toThrow('state machine');
    await expect(Group.findOneAndUpdate({}, { status: S.WON })).rejects.toThrow('state machine');
  });
});
