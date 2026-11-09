/**
 * Leaving and the waitlist (GRP-5, PAY-3) and Route transfers (PAY-4):
 * - leave while open = full refund; after lock = token minus back-out fee; locked during
 *   the auction; the seat is freed in a transaction and offered to the waitlist;
 * - waitlist offers go to the next person for 2 h; expired offers move to the back;
 * - transfers: token minus commission on hold, release, reversal, failed transfer
 *   corrected with reversal entries; refunded tokens are never transferred.
 */
jest.mock('../../../src/services/purchases/purchase.service', () => ({
  getMyPurchase: jest.fn(async () => null),
  cancelMemberPurchase: jest.fn(async () => {}),
}));
jest.mock('../../../src/models/group.model', () => ({ findById: jest.fn(), updateOne: jest.fn() }));
jest.mock('../../../src/models/groupMember.model', () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  updateOne: jest.fn(),
  countDocuments: jest.fn(async () => 0),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../../../src/models/payment.model', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../../../src/models/seller.model', () => ({ findById: jest.fn() }));
jest.mock('../../../src/utils/transaction', () => ({
  withTransaction: jest.fn(async (work) => work({ id: 'session' })),
}));
jest.mock('../../../src/services/settings.service', () => ({
  getPaymentSettings: jest.fn(async () => ({ seatReservationMinutes: 15, waitlistOfferHours: 2 })),
}));
jest.mock('../../../src/jobs/queues', () => ({ enqueueRefund: jest.fn(async () => true) }));
jest.mock('../../../src/services/payments/razorpay.service', () => ({
  createTransfer: jest.fn(),
  releaseTransferHold: jest.fn(),
  reverseTransfer: jest.fn(),
  createRefund: jest.fn(),
}));
jest.mock('../../../src/services/payments/ledger.service', () => ({ recordLedger: jest.fn() }));

const { Types } = require('mongoose');
const Group = require('../../../src/models/group.model');
const GroupMember = require('../../../src/models/groupMember.model');
const Payment = require('../../../src/models/payment.model');
const Seller = require('../../../src/models/seller.model');
const { enqueueRefund } = require('../../../src/jobs/queues');
const razorpay = require('../../../src/services/payments/razorpay.service');
const { recordLedger } = require('../../../src/services/payments/ledger.service');
const membership = require('../../../src/services/groups/membership.service');
const route = require('../../../src/services/payments/route.service');

const userId = new Types.ObjectId().toString();
const groupId = new Types.ObjectId().toString();
const paymentId = new Types.ObjectId();
const lean = (value) => ({ lean: async () => value, select: () => ({ lean: async () => value }) });
const group = (overrides = {}) => ({
  _id: groupId,
  status: 'open',
  memberCount: 5,
  targetSize: 10,
  tokenAmountPaise: 100_000,
  backoutFeePaise: 9_900,
  ...overrides,
});
const member = { _id: new Types.ObjectId(), status: 'active', paymentId };
const payment = {
  _id: paymentId,
  amountPaise: 100_000,
  status: 'paid',
  razorpayPaymentId: 'pay_1',
  userId,
  groupId,
  refunds: [],
};

beforeEach(() => jest.clearAllMocks());

describe('leave terms', () => {
  it.each([
    ['open: full refund', group(), { canLeave: true, refundPaise: 100_000, feePaise: 0 }],
    [
      'full (seats locked): minus ₹99 back-out fee',
      group({ status: 'full' }),
      { canLeave: true, refundPaise: 90_100, feePaise: 9_900 },
    ],
    [
      'auction live: locked',
      group({ status: 'auction_live' }),
      { canLeave: false, reason: 'SEATS_LOCKED' },
    ],
  ])('%s', (_label, groupDoc, expected) => {
    expect(membership.computeLeaveTerms(groupDoc, member, payment)).toMatchObject(expected);
  });

  it('caps the fee at the token', () => {
    expect(
      membership.computeLeaveTerms(
        group({ status: 'full', backoutFeePaise: 500_000 }),
        member,
        payment,
      ),
    ).toMatchObject({
      refundPaise: 0,
      feePaise: 100_000,
    });
  });

  it('refuses people who did not pay', () => {
    expect(membership.computeLeaveTerms(group(), null, null)).toMatchObject({
      canLeave: false,
      reason: 'NOT_A_MEMBER',
    });
  });
});

describe('leaveGroup', () => {
  const given = (groupDoc) => {
    Group.findById.mockReturnValue(lean(groupDoc));
    GroupMember.findOne.mockReturnValue(lean(member));
    Payment.findOne.mockReturnValue(lean(payment));
    GroupMember.updateOne.mockResolvedValue({ modifiedCount: 1, matchedCount: 1 });
    Group.updateOne.mockResolvedValue({ modifiedCount: 1 });
  };

  it('frees the seat in one transaction and queues a full refund from an open group', async () => {
    given(group());
    await membership.leaveGroup(groupId, userId);
    expect(Group.updateOne).toHaveBeenCalledWith(
      { _id: groupId, status: 'open', memberCount: { $gt: 0 } },
      { $inc: { memberCount: -1 } },
      { session: { id: 'session' } },
    );
    expect(enqueueRefund).toHaveBeenCalledWith({
      paymentId: String(paymentId),
      reason: 'left_open_group',
      amountPaise: 100_000,
      feePaise: 0,
    });
  });

  it('keeps the back-out fee after lock and offers the seat to the waitlist', async () => {
    given(group({ status: 'full', memberCount: 10 }));
    await membership.leaveGroup(groupId, userId);
    expect(enqueueRefund).toHaveBeenCalledWith({
      paymentId: String(paymentId),
      reason: 'left_after_lock',
      amountPaise: 90_100,
      feePaise: 9_900,
    });
    expect(Group.findById).toHaveBeenCalledTimes(3); // load, live counter, offerNextSeat
  });

  it('after a win, takes the held token back from the dealer before refunding (exit window)', async () => {
    const exitEnds = new Date(Date.now() + 3_600_000);
    given(group({ status: 'won', exitWindowEndsAt: exitEnds }));
    const held = {
      ...payment,
      status: 'transferred',
      transfer: {
        razorpayTransferId: 'trf_1',
        amountPaise: 50_000,
        commissionPaise: 50_000,
        status: 'processed',
      },
    };
    Payment.findOne.mockReturnValue(lean(held));
    Payment.findById.mockReturnValue(lean(held));
    await membership.leaveGroup(groupId, userId);
    expect(razorpay.reverseTransfer).toHaveBeenCalledWith('trf_1', 50_000);
    expect(enqueueRefund).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'left_after_win', amountPaise: 90_100, feePaise: 9_900 }),
    );
  });

  it('does not refund when the group changed meanwhile (auction started)', async () => {
    given(group());
    Group.updateOne.mockResolvedValue({ modifiedCount: 0 });
    await expect(membership.leaveGroup(groupId, userId)).rejects.toMatchObject({
      code: 'GROUP_CHANGED',
    });
    expect(enqueueRefund).not.toHaveBeenCalled();
  });
});

describe('waitlist', () => {
  it('offers a freed seat to the next person for 2 hours', async () => {
    const now = new Date('2026-11-08T10:00:00Z');
    Group.findById.mockReturnValue(lean(group({ status: 'full', memberCount: 9 })));
    GroupMember.findOneAndUpdate.mockResolvedValueOnce({ userId: 'u2' });
    expect(await membership.offerNextSeat(groupId, now)).toBe(1);
    const [filter, update, options] = GroupMember.findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({ status: 'waitlisted', offerExpiresAt: { $exists: false } });
    expect(update.$set.offerExpiresAt).toEqual(new Date('2026-11-08T12:00:00Z'));
    expect(options.sort).toEqual({ waitlistPosition: 1 });
  });

  it('does not offer seats while a live offer covers the free seat', async () => {
    Group.findById.mockReturnValue(lean(group({ status: 'full', memberCount: 9 })));
    GroupMember.countDocuments.mockResolvedValueOnce(1);
    expect(await membership.offerNextSeat(groupId)).toBe(0);
    expect(GroupMember.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('only full groups have a waitlist', async () => {
    Group.findById.mockReturnValue(lean(group()));
    GroupMember.findOne.mockReturnValue(lean(null));
    await expect(membership.joinWaitlist(groupId, userId)).rejects.toMatchObject({
      code: 'SEATS_AVAILABLE',
    });
  });
});

describe('Route transfers', () => {
  const rule = { type: 'flat', value: 50_000 };

  it('sends token minus commission to the dealer on hold and writes both ledger rows', async () => {
    Payment.findById.mockReturnValue(lean(payment));
    Seller.findById.mockReturnValue(lean({ razorpayAccountId: 'acc_D1' }));
    razorpay.createTransfer.mockResolvedValue({ items: [{ id: 'trf_1' }] });

    const result = await route.createHeldTransfer(paymentId, {
      sellerId: 's1',
      pricePerUnitPaise: 9_000_000,
      commissionRule: rule,
    });

    expect(result).toMatchObject({
      outcome: 'created',
      transferPaise: 50_000,
      fromTokenPaise: 50_000,
    });
    expect(razorpay.createTransfer).toHaveBeenCalledWith(
      'pay_1',
      expect.objectContaining({ accountId: 'acc_D1', amountPaise: 50_000, onHold: true }),
    );
    expect(recordLedger).toHaveBeenCalledWith(
      [
        expect.objectContaining({ type: 'transfer', amountPaise: 50_000 }),
        expect.objectContaining({ type: 'commission', amountPaise: 50_000 }),
      ],
      { id: 'session' },
    );
  });

  it('re-transfers a token whose earlier transfer was reversed (runner-up takes over)', async () => {
    Payment.findById.mockReturnValue(
      lean({ ...payment, transfer: { status: 'reversed', razorpayTransferId: 'trf_old' } }),
    );
    Seller.findById.mockReturnValue(lean({ razorpayAccountId: 'acc_D2' }));
    razorpay.createTransfer.mockResolvedValue({ items: [{ id: 'trf_2' }] });
    const result = await route.createHeldTransfer(paymentId, {
      sellerId: 's2',
      pricePerUnitPaise: 9_000_000,
      commissionRule: rule,
    });
    expect(result.outcome).toBe('created');
  });

  it('does not create a second transfer while one is live', async () => {
    Payment.findById.mockReturnValue(lean({ ...payment, transfer: { status: 'processed' } }));
    const result = await route.createHeldTransfer(paymentId, {
      sellerId: 's1',
      pricePerUnitPaise: 9_000_000,
      commissionRule: rule,
    });
    expect(result.outcome).toBe('already');
    expect(razorpay.createTransfer).not.toHaveBeenCalled();
  });

  it('never transfers a refunded token', async () => {
    Payment.findById.mockReturnValue(
      lean({ ...payment, refunds: [{ amountPaise: 100_000, status: 'pending' }] }),
    );
    await expect(
      route.createHeldTransfer(paymentId, {
        sellerId: 's1',
        pricePerUnitPaise: 1,
        commissionRule: rule,
      }),
    ).rejects.toMatchObject({
      code: 'TOKEN_NOT_HELD',
    });
    expect(razorpay.createTransfer).not.toHaveBeenCalled();
  });

  it('releases a hold once and reverses with correcting entries', async () => {
    const transfer = {
      razorpayTransferId: 'trf_1',
      sellerId: 's1',
      amountPaise: 50_000,
      commissionPaise: 50_000,
      status: 'processed',
      onHold: true,
    };
    Payment.findById.mockReturnValue(lean({ ...payment, transfer }));
    expect(await route.releaseHold(paymentId)).toEqual({ outcome: 'released' });
    expect(recordLedger).toHaveBeenCalledWith(
      [expect.objectContaining({ type: 'hold_release', amountPaise: 50_000 })],
      { id: 'session' },
    );

    recordLedger.mockClear();
    expect(await route.reverseHeldTransfer(paymentId, 'member_exit')).toEqual({
      outcome: 'reversed',
    });
    expect(recordLedger).toHaveBeenCalledWith(
      [
        expect.objectContaining({ type: 'transfer_reversal', amountPaise: 50_000 }),
        expect.objectContaining({ type: 'commission_reversal', amountPaise: 50_000 }),
      ],
      { id: 'session' },
    );

    Payment.findById.mockReturnValue(
      lean({ ...payment, transfer: { ...transfer, status: 'released' } }),
    );
    await expect(route.reverseHeldTransfer(paymentId, 'x')).rejects.toMatchObject({
      code: 'TRANSFER_RELEASED',
    });
  });

  it('corrects the ledger when Razorpay reports the transfer failed', async () => {
    Payment.findOneAndUpdate.mockResolvedValue({
      ...payment,
      transfer: { sellerId: 's1', amountPaise: 50_000, commissionPaise: 50_000 },
    });
    expect(await route.handleTransferEvent({ id: 'trf_1' }, true)).toBe(true);
    expect(recordLedger).toHaveBeenCalledWith(
      [
        expect.objectContaining({ type: 'transfer_reversal' }),
        expect.objectContaining({ type: 'commission_reversal' }),
      ],
      { id: 'session' },
    );
  });
});
