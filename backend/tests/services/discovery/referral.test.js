/**
 * Referral and wallet credits (REF-1 to REF-3, decided 12 Nov 2026): a new account adds a
 * friend's code once (not their own, not after a purchase, not after 30 days, no loops);
 * the friend's FIRST completed purchase pays ₹100 + ₹100 once; the leader bonus (₹500)
 * needs the leader's own purchase and 3 other buyers; credits are idempotent per key.
 */
jest.mock('../../../src/utils/transaction', () => ({
  withTransaction: jest.fn(async (work) => work({ id: 'session' })),
}));
jest.mock('../../../src/services/notifications/notification.service', () => ({
  notifyUsers: jest.fn(async () => 1),
}));
jest.mock('../../../src/services/settings.service', () => ({
  getFeatureFlags: jest.fn(async () => ({ referrals: true })),
  getReferralSettings: jest.fn(async () => ({
    referrerCreditPaise: 10_000,
    friendCreditPaise: 10_000,
    leaderBonusPaise: 50_000,
    leaderBonusMinOtherPurchases: 3,
    claimWithinDays: 30,
  })),
}));

const { Types } = require('mongoose');
const User = require('../../../src/models/user.model');
const Group = require('../../../src/models/group.model');
const Purchase = require('../../../src/models/purchase.model');
const WalletTransaction = require('../../../src/models/walletTransaction.model');
const { getFeatureFlags } = require('../../../src/services/settings.service');
const { creditWallet } = require('../../../src/services/wallet/wallet.service');
const referral = require('../../../src/services/wallet/referral.service');

const NOW = new Date('2026-11-12T10:00:00Z');
const DAY = 24 * 3_600_000;
const userId = String(new Types.ObjectId());
const referrerId = new Types.ObjectId();
const query = (value) => ({ select: () => query(value), lean: async () => value });

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('creditWallet', () => {
  it('adds credits and records the new balance in one transaction', async () => {
    jest.spyOn(WalletTransaction, 'exists').mockResolvedValue(null);
    jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue({ walletBalancePaise: 25_000 });
    const create = jest.spyOn(WalletTransaction, 'create').mockResolvedValue([{}]);
    const result = await creditWallet({
      userId,
      amountPaise: 10_000,
      type: 'referral_friend',
      key: 'k1',
    });
    expect(result).toEqual({ outcome: 'credited', balancePaise: 25_000 });
    expect(User.findOneAndUpdate.mock.calls[0][1]).toEqual({
      $inc: { walletBalancePaise: 10_000 },
    });
    expect(create.mock.calls[0][0][0]).toMatchObject({
      amountPaise: 10_000,
      balanceAfterPaise: 25_000,
      key: 'k1',
    });
  });

  it('never pays the same reward twice', async () => {
    jest.spyOn(WalletTransaction, 'exists').mockResolvedValue({ _id: 'x' });
    const inc = jest.spyOn(User, 'findOneAndUpdate');
    expect(
      await creditWallet({ userId, amountPaise: 10_000, type: 'referral_friend', key: 'k1' }),
    ).toEqual({
      outcome: 'already',
    });
    expect(inc).not.toHaveBeenCalled();

    // Two at once: the unique key aborts the second transaction
    WalletTransaction.exists.mockResolvedValue(null);
    inc.mockResolvedValue({ walletBalancePaise: 10_000 });
    jest
      .spyOn(WalletTransaction, 'create')
      .mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    expect(
      await creditWallet({ userId, amountPaise: 10_000, type: 'referral_friend', key: 'k1' }),
    ).toEqual({
      outcome: 'already',
    });
  });

  it('skips zero or float amounts', async () => {
    expect(await creditWallet({ userId, amountPaise: 0, type: 'x', key: 'k' })).toEqual({
      outcome: 'skipped',
    });
    expect(await creditWallet({ userId, amountPaise: 99.5, type: 'x', key: 'k' })).toEqual({
      outcome: 'skipped',
    });
  });
});

describe('applyReferralCode', () => {
  const newUser = (overrides = {}) => ({
    _id: userId,
    referralCode: 'MYCODE12',
    createdAt: new Date(NOW.getTime() - 2 * DAY),
    ...overrides,
  });
  const given = (user, referrer = { _id: referrerId }, bought = null) => {
    jest.spyOn(User, 'findById').mockReturnValue(query(user));
    jest.spyOn(Purchase, 'exists').mockResolvedValue(bought);
    jest.spyOn(User, 'findOne').mockReturnValue(query(referrer));
  };

  it.each([
    [
      'already has a referrer',
      newUser({ referredBy: referrerId }),
      undefined,
      null,
      'REFERRAL_ALREADY_SET',
    ],
    [
      'account older than 30 days',
      newUser({ createdAt: new Date(NOW.getTime() - 31 * DAY) }),
      undefined,
      null,
      'REFERRAL_TOO_LATE',
    ],
    ['already bought', newUser(), undefined, { _id: 'p' }, 'REFERRAL_TOO_LATE'],
    ['unknown code', newUser(), null, null, 'REFERRAL_CODE_INVALID'],
    ['referral loop', newUser(), { _id: referrerId, referredBy: userId }, null, 'REFERRAL_LOOP'],
  ])('refuses: %s', async (_label, user, referrer, bought, code) => {
    given(user, referrer === undefined ? { _id: referrerId } : referrer, bought);
    await expect(referral.applyReferralCode(userId, 'FRIEND12', NOW)).rejects.toMatchObject({
      code,
    });
  });

  it('refuses my own code', async () => {
    given(newUser());
    await expect(referral.applyReferralCode(userId, 'mycode12', NOW)).rejects.toMatchObject({
      code: 'OWN_REFERRAL_CODE',
    });
  });

  it('refuses while referrals are switched off', async () => {
    getFeatureFlags.mockResolvedValueOnce({ referrals: false });
    await expect(referral.applyReferralCode(userId, 'FRIEND12', NOW)).rejects.toMatchObject({
      code: 'REFERRALS_OFF',
    });
  });
});

describe('rewards', () => {
  const purchase = { _id: new Types.ObjectId(), userId };

  it("friend's first completed purchase pays both, keyed per friend", async () => {
    jest
      .spyOn(User, 'findById')
      .mockReturnValueOnce(query({ referredBy: referrerId }))
      .mockReturnValueOnce(query({ status: 'active' }));
    jest.spyOn(WalletTransaction, 'exists').mockResolvedValue(null);
    jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue({ walletBalancePaise: 10_000 });
    const create = jest.spyOn(WalletTransaction, 'create').mockResolvedValue([{}]);

    await referral.onPurchaseCompleted(purchase);
    const keys = create.mock.calls.map((call) => call[0][0].key);
    expect(keys).toEqual([`referral-friend:${userId}`, `referral-referrer:${userId}`]);
    expect(create.mock.calls.map((call) => call[0][0].amountPaise)).toEqual([10_000, 10_000]);
  });

  it('no referrer, no credits', async () => {
    jest.spyOn(User, 'findById').mockReturnValue(query({}));
    const create = jest.spyOn(WalletTransaction, 'create');
    await referral.onPurchaseCompleted(purchase);
    expect(create).not.toHaveBeenCalled();
  });

  it('leader bonus needs the leader to buy plus 3 other buyers', () => {
    const leaderId = 'L';
    const bought = (...ids) => ids.map((id) => ({ userId: id }));
    expect(referral.qualifiesForLeaderBonus({ leaderId }, bought('L', 'a', 'b', 'c'), 3)).toBe(
      true,
    );
    expect(referral.qualifiesForLeaderBonus({ leaderId }, bought('a', 'b', 'c', 'd'), 3)).toBe(
      false,
    );
    expect(referral.qualifiesForLeaderBonus({ leaderId }, bought('L', 'a', 'b', 'b'), 3)).toBe(
      false,
    );
  });

  it('pays the leader bonus once per completed group', async () => {
    const groupId = new Types.ObjectId();
    jest.spyOn(Group, 'findById').mockReturnValue(query({ status: 'completed', leaderId: 'L' }));
    jest
      .spyOn(Purchase, 'find')
      .mockReturnValue(query([{ userId: 'L' }, { userId: 'a' }, { userId: 'b' }, { userId: 'c' }]));
    jest.spyOn(WalletTransaction, 'exists').mockResolvedValue(null);
    jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue({ walletBalancePaise: 50_000 });
    const create = jest.spyOn(WalletTransaction, 'create').mockResolvedValue([{}]);

    await referral.onGroupCompleted(groupId);
    expect(create.mock.calls[0][0][0]).toMatchObject({
      type: 'leader_bonus',
      amountPaise: 50_000,
      key: `leader-bonus:${groupId}`,
    });
  });
});
