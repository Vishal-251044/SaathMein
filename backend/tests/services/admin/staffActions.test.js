/**
 * Staff actions from the monitors (PRD §10.11): auction pause / resume / extend / cancel /
 * force runner-up, group extend, and every money path — retry refund, manual refund
 * (limits, holds), release and reverse holds — plus dealer penalties and buyer suspension.
 */
jest.mock('../../../src/services/groups/stateMachine', () => ({
  transition: jest.fn(async (group, to) => ({ ...group, status: to })),
}));
jest.mock('../../../src/services/groups/groupLive', () => ({ publishGroupStatus: jest.fn() }));
jest.mock('../../../src/jobs/queues', () => ({ scheduleAuctionClose: jest.fn() }));
jest.mock('../../../src/sockets/emitter', () => ({ emitToStaff: jest.fn() }));
jest.mock('../../../src/services/payments/refund.service', () => ({
  queueRefund: jest.fn(),
  committedRefundPaise: (payment) =>
    (payment.refunds || [])
      .filter((refund) => refund.status !== 'failed')
      .reduce((total, refund) => total + refund.amountPaise + (refund.feePaise || 0), 0),
}));
jest.mock('../../../src/services/payments/route.service', () => ({
  releaseHold: jest.fn(async () => ({ outcome: 'released' })),
  reverseHeldTransfer: jest.fn(async () => ({ outcome: 'reversed' })),
}));
jest.mock('../../../src/services/trust/penalty.service', () => ({
  applyPenalties: jest.fn(async () => 1),
}));
jest.mock('../../../src/services/trust/rating.service', () => ({
  recomputeSellerRating: jest.fn(),
}));
jest.mock('../../../src/services/auth/session.service', () => ({
  revokeUserSessions: jest.fn(async () => 2),
}));
jest.mock('../../../src/services/auction/winner.service', () => ({
  handOverToRunnerUp: jest.fn(async (group) => ({ ...group, status: 'runner_up' })),
}));

const { Types } = require('mongoose');
const Group = require('../../../src/models/group.model');
const Payment = require('../../../src/models/payment.model');
const Seller = require('../../../src/models/seller.model');
const User = require('../../../src/models/user.model');
const { transition } = require('../../../src/services/groups/stateMachine');
const { scheduleAuctionClose } = require('../../../src/jobs/queues');
const { queueRefund } = require('../../../src/services/payments/refund.service');
const route = require('../../../src/services/payments/route.service');
const { recomputeSellerRating } = require('../../../src/services/trust/rating.service');
const { revokeUserSessions } = require('../../../src/services/auth/session.service');
const { handOverToRunnerUp } = require('../../../src/services/auction/winner.service');
const actions = require('../../../src/services/admin/staffActions.service');
const { GROUP_STATUS: S } = require('../../../src/constants/enums');

const HOUR = 3600_000;
const staffId = String(new Types.ObjectId());
const groupId = String(new Types.ObjectId());
const paymentId = String(new Types.ObjectId());
const lean = (value) => ({ lean: async () => value });

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('auction actions', () => {
  const endsAt = new Date('2026-11-13T12:00:00Z');
  const live = (auction = {}) => ({
    _id: groupId,
    status: S.AUCTION_LIVE,
    auction: { endsAt, ...auction },
  });

  it('pause stops a running auction once', async () => {
    jest.spyOn(Group, 'findById').mockResolvedValue(live());
    const update = jest
      .spyOn(Group, 'findOneAndUpdate')
      .mockResolvedValue(live({ pausedAt: new Date() }));
    const result = await actions.pauseAuction(groupId);
    expect(update.mock.calls[0][1].$set['auction.pausedAt']).toBeInstanceOf(Date);
    expect(result.after.pausedAt).toBeInstanceOf(Date);

    jest.spyOn(Group, 'findById').mockResolvedValue(live({ pausedAt: new Date() }));
    await expect(actions.pauseAuction(groupId)).rejects.toMatchObject({ code: 'ALREADY_PAUSED' });
  });

  it('resume adds the paused time to the end and reschedules the close', async () => {
    const pausedAt = new Date('2026-11-13T10:00:00Z');
    const now = new Date('2026-11-13T10:30:00Z');
    jest.spyOn(Group, 'findById').mockResolvedValue(live({ pausedAt }));
    const update = jest.spyOn(Group, 'findOneAndUpdate').mockResolvedValue(live());
    await actions.resumeAuction(groupId, now);
    expect(update.mock.calls[0][1].$set['auction.endsAt']).toEqual(
      new Date(endsAt.getTime() + 30 * 60_000),
    );
    expect(update.mock.calls[0][1].$unset).toEqual({ 'auction.pausedAt': 1 });
    expect(scheduleAuctionClose).toHaveBeenCalled();
  });

  it('extend moves the end time and refuses a closed auction', async () => {
    jest.spyOn(Group, 'findById').mockResolvedValue(live());
    const update = jest.spyOn(Group, 'findOneAndUpdate').mockResolvedValue(live());
    await actions.extendAuction(groupId, 2);
    expect(update.mock.calls[0][1].$set['auction.endsAt']).toEqual(
      new Date(endsAt.getTime() + 2 * HOUR),
    );

    jest.spyOn(Group, 'findById').mockResolvedValue({ ...live(), status: S.WON });
    await expect(actions.extendAuction(groupId, 2)).rejects.toMatchObject({
      code: 'AUCTION_NOT_LIVE',
    });
  });

  it('cancel goes through the state machine as staff (refunds follow)', async () => {
    jest.spyOn(Group, 'findById').mockResolvedValue(live());
    await actions.cancelGroup(groupId, staffId);
    expect(transition).toHaveBeenCalledWith(
      expect.anything(),
      S.CANCELLED,
      expect.objectContaining({ actor: { type: 'staff', id: staffId } }),
    );
  });

  it('cancel is refused once the group completed', async () => {
    jest.spyOn(Group, 'findById').mockResolvedValue({ _id: groupId, status: S.COMPLETED });
    await expect(actions.cancelGroup(groupId, staffId)).rejects.toMatchObject({
      code: 'CANNOT_CANCEL',
    });
  });

  it('force runner-up hands a won group over, penalty optional', async () => {
    const sellerId = new Types.ObjectId();
    jest.spyOn(Group, 'findById').mockResolvedValue({ _id: groupId, status: S.WON, sellerId });
    await actions.forceRunnerUp(groupId, staffId, 'Dealer stopped answering the buyers', false);
    expect(handOverToRunnerUp).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sellerId: String(sellerId), actorType: 'staff', penalise: false }),
    );

    jest.spyOn(Group, 'findById').mockResolvedValue({ _id: groupId, status: S.PURCHASING });
    await expect(
      actions.forceRunnerUp(groupId, staffId, 'x'.repeat(10), true),
    ).rejects.toMatchObject({
      code: 'CANNOT_FORCE_RUNNER_UP',
    });
  });

  it('group extend only applies to open groups', async () => {
    const deadline = new Date('2026-11-20T00:00:00Z');
    jest.spyOn(Group, 'findById').mockReturnValue(lean({ _id: groupId, status: S.OPEN, deadline }));
    const update = jest.spyOn(Group, 'updateOne').mockResolvedValue({});
    const result = await actions.extendGroupDeadline(groupId, 3);
    expect(result.after.deadline).toEqual(new Date(deadline.getTime() + 3 * 24 * HOUR));
    expect(update).toHaveBeenCalled();

    jest.spyOn(Group, 'findById').mockReturnValue(lean({ _id: groupId, status: S.FULL, deadline }));
    await expect(actions.extendGroupDeadline(groupId, 3)).rejects.toMatchObject({
      code: 'GROUP_NOT_OPEN',
    });
  });
});

describe('payment actions (money)', () => {
  const paid = (extra = {}) => ({
    _id: paymentId,
    status: 'paid',
    amountPaise: 99_900,
    refunds: [],
    ...extra,
  });

  it('manual refund up to what is still refundable, numbered per payment', async () => {
    jest.spyOn(Payment, 'findById').mockReturnValue(lean(paid()));
    await actions.manualRefund(paymentId, 50_000, staffId);
    expect(queueRefund).toHaveBeenCalledWith(paymentId, {
      reason: 'manual_refund_1',
      amountPaise: 50_000,
      feePaise: 0,
      initiatedBy: staffId,
    });

    const partly = paid({
      status: 'partially_refunded',
      refunds: [{ reason: 'manual_refund_1', amountPaise: 50_000, status: 'processed' }],
    });
    jest.spyOn(Payment, 'findById').mockReturnValue(lean(partly));
    await actions.manualRefund(paymentId, 49_900, staffId);
    expect(queueRefund.mock.calls[1][1].reason).toBe('manual_refund_2');
  });

  it('manual refund refuses more than the remaining amount', async () => {
    const partly = paid({
      status: 'partially_refunded',
      refunds: [{ reason: 'left_open_group', amountPaise: 90_000, status: 'processed' }],
    });
    jest.spyOn(Payment, 'findById').mockReturnValue(lean(partly));
    await expect(actions.manualRefund(paymentId, 10_000, staffId)).rejects.toMatchObject({
      code: 'INVALID_REFUND_AMOUNT',
    });
    expect(queueRefund).not.toHaveBeenCalled();
  });

  it('manual refund refuses a token on hold at the dealer (reverse it first)', async () => {
    jest
      .spyOn(Payment, 'findById')
      .mockReturnValue(lean(paid({ status: 'transferred', transfer: { status: 'processed' } })));
    await expect(actions.manualRefund(paymentId, 1000, staffId)).rejects.toMatchObject({
      code: 'REVERSE_HOLD_FIRST',
    });
  });

  it('manual refund refuses refunded or failed payments', async () => {
    jest.spyOn(Payment, 'findById').mockReturnValue(lean(paid({ status: 'refunded' })));
    await expect(actions.manualRefund(paymentId, 1000, staffId)).rejects.toMatchObject({
      code: 'NOT_REFUNDABLE',
    });
  });

  it('retry re-queues the failed refund with the same reason (idempotent claim)', async () => {
    const failed = paid({
      refunds: [{ reason: 'expired', amountPaise: 99_900, feePaise: 0, status: 'failed' }],
    });
    jest.spyOn(Payment, 'findById').mockReturnValue(lean(failed));
    await actions.retryRefund(paymentId);
    expect(queueRefund).toHaveBeenCalledWith(paymentId, {
      reason: 'expired',
      amountPaise: 99_900,
      feePaise: 0,
    });

    jest.spyOn(Payment, 'findById').mockReturnValue(lean(paid()));
    await expect(actions.retryRefund(paymentId)).rejects.toMatchObject({
      code: 'NO_FAILED_REFUND',
    });
  });

  it('release and reverse go through the Route service', async () => {
    jest
      .spyOn(Payment, 'findById')
      .mockReturnValue(lean(paid({ transfer: { status: 'processed' } })));
    await actions.releasePaymentHold(paymentId);
    expect(route.releaseHold).toHaveBeenCalledWith(paymentId);
    await actions.reversePaymentHold(paymentId, 'Buyer bought elsewhere');
    expect(route.reverseHeldTransfer).toHaveBeenCalledWith(
      paymentId,
      'staff:Buyer bought elsewhere',
    );
  });
});

describe('dealer and buyer actions', () => {
  const sellerId = String(new Types.ObjectId());
  const penaltyId = new Types.ObjectId();

  it('lifting a rating penalty recomputes the rating; twice is refused', async () => {
    jest.spyOn(Seller, 'findOne').mockReturnValue({
      select: () => lean({ penalties: [{ _id: penaltyId, type: 'rating_penalty' }] }),
    });
    const update = jest.spyOn(Seller, 'updateOne').mockResolvedValue({});
    await actions.liftPenalty(sellerId, String(penaltyId), {
      reason: 'Dispute decided for dealer',
      staffId,
    });
    expect(update.mock.calls[0][1].$set['penalties.$.liftedBy']).toBe(staffId);
    expect(recomputeSellerRating).toHaveBeenCalledWith(sellerId);

    jest.spyOn(Seller, 'findOne').mockReturnValue({
      select: () =>
        lean({ penalties: [{ _id: penaltyId, type: 'warning', liftedAt: new Date() }] }),
    });
    await expect(
      actions.liftPenalty(sellerId, String(penaltyId), { reason: 'again', staffId }),
    ).rejects.toMatchObject({ code: 'ALREADY_LIFTED' });
  });

  it('suspending a buyer ends their sessions; staff accounts are refused', async () => {
    jest.spyOn(User, 'findById').mockReturnValue({ select: () => lean({ status: 'active' }) });
    const update = jest.spyOn(User, 'updateOne').mockResolvedValue({});
    const result = await actions.setBuyerStatus('u1', false);
    expect(update.mock.calls[0][1]).toEqual({ $set: { status: 'suspended' } });
    expect(revokeUserSessions).toHaveBeenCalledWith('u1', 'suspended');
    expect(result).toEqual({ before: { status: 'active' }, after: { status: 'suspended' } });

    jest
      .spyOn(User, 'findById')
      .mockReturnValue({ select: () => lean({ status: 'active', staffRole: 'admin' }) });
    await expect(actions.setBuyerStatus('u2', false)).rejects.toMatchObject({ statusCode: 403 });
  });
});
