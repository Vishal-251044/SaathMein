/**
 * Disputes (TRU-4, PAY-6; decided 12 Nov 2026): open rules, 48 h dealer SLA, and every
 * money path of Support's decision — refund while the token is with SaathMein or on hold
 * (hold reversed first), wallet credits once released (billed to the dealer), wrong path
 * refused, credit limit, penalties, and no double decision.
 */
jest.mock('../../../src/services/settings.service', () => ({
  getDisputeSettings: jest.fn(async () => ({
    sellerResponseHours: 48,
    suspensionDays: 30,
    maxEvidenceFiles: 6,
  })),
}));
jest.mock('../../../src/services/upload.service', () => ({
  verifyDisputeEvidence: jest.fn(),
  createDisputeEvidenceUploadParams: jest.fn(() => ({ uploadUrl: 'u', fields: {} })),
  privateFileUrl: jest.fn(() => 'https://signed'),
}));
jest.mock('../../../src/services/notifications/notification.service', () => ({
  notifyUsers: jest.fn(async () => 1),
}));
jest.mock('../../../src/services/auction/winner.service', () => ({ notifyDealer: jest.fn() }));
jest.mock('../../../src/services/payments/route.service', () => ({
  reverseHeldTransfer: jest.fn(async () => ({ outcome: 'reversed' })),
}));
jest.mock('../../../src/services/payments/refund.service', () => ({
  queueRefund: jest.fn(async () => true),
  REFUND_REASON: { DISPUTE_REFUND: 'dispute_refund' },
}));
jest.mock('../../../src/services/wallet/wallet.service', () => ({
  creditWallet: jest.fn(async () => ({ outcome: 'credited' })),
}));
jest.mock('../../../src/services/trust/penalty.service', () => ({
  applyPenalties: jest.fn(async () => 1),
}));
jest.mock('../../../src/services/purchases/purchase.service', () => ({ advanceGroup: jest.fn() }));

const { Types } = require('mongoose');
const Dispute = require('../../../src/models/dispute.model');
const Group = require('../../../src/models/group.model');
const GroupMember = require('../../../src/models/groupMember.model');
const Payment = require('../../../src/models/payment.model');
const Purchase = require('../../../src/models/purchase.model');
const User = require('../../../src/models/user.model');
const SellerDue = require('../../../src/models/sellerDue.model');
const { reverseHeldTransfer } = require('../../../src/services/payments/route.service');
const { queueRefund } = require('../../../src/services/payments/refund.service');
const { creditWallet } = require('../../../src/services/wallet/wallet.service');
const { applyPenalties } = require('../../../src/services/trust/penalty.service');
const { verifyDisputeEvidence } = require('../../../src/services/upload.service');
const disputes = require('../../../src/services/trust/dispute.service');

const NOW = new Date('2026-11-12T10:00:00Z');
const HOUR = 3_600_000;
const buyerId = String(new Types.ObjectId());
const sellerId = new Types.ObjectId();
const staffId = String(new Types.ObjectId());
const disputeId = String(new Types.ObjectId());
const paymentId = new Types.ObjectId();
const lean = (value) => {
  const chain = {
    select: () => chain,
    sort: () => chain,
    populate: () => chain,
    limit: () => chain,
    lean: async () => value,
  };
  return chain;
};

const purchase = (overrides = {}) => ({
  _id: new Types.ObjectId(),
  groupId: new Types.ObjectId(),
  memberId: new Types.ObjectId(),
  userId: buyerId,
  sellerId,
  paymentId,
  status: 'pending',
  pricePaise: 8_500_000,
  tokenPaise: 99_900,
  ...overrides,
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('openDispute', () => {
  const input = (overrides = {}) => ({
    purchaseId: 'p1',
    type: 'price_not_honoured',
    description: 'Dealer asked ₹4,000 more than the winning price at the showroom.',
    evidence: [{ publicId: 'saathmein/disputes/u_x/abc', version: 1, signature: 'sig1234567' }],
    ...overrides,
  });

  it('opens with evidence and gives the dealer 48 h', async () => {
    jest.spyOn(Purchase, 'findOne').mockReturnValue(lean(purchase()));
    jest.spyOn(Dispute, 'exists').mockResolvedValue(null);
    jest.spyOn(Group, 'findById').mockReturnValue(lean(null));
    const create = jest
      .spyOn(Dispute, 'create')
      .mockImplementation(async (doc) => ({ ...doc, _id: disputeId, toObject: () => doc }));
    await disputes.openDispute(buyerId, input(), NOW);
    expect(verifyDisputeEvidence).toHaveBeenCalledWith(`u_${buyerId}`, input().evidence[0]);
    expect(create.mock.calls[0][0]).toMatchObject({
      buyerId,
      sellerId,
      sellerDueAt: new Date(NOW.getTime() + 48 * HOUR),
      evidence: [{ addedBy: 'buyer', publicId: 'saathmein/disputes/u_x/abc' }],
    });
  });

  it.each([
    ['not my purchase', null, null, 404],
    ['expired purchase', purchase({ status: 'expired' }), null, 409],
    ['already open', purchase(), { _id: 'd' }, 409],
  ])('refuses: %s', async (_label, row, open, status) => {
    jest.spyOn(Purchase, 'findOne').mockReturnValue(lean(row));
    jest.spyOn(Dispute, 'exists').mockResolvedValue(open);
    await expect(disputes.openDispute(buyerId, input(), NOW)).rejects.toMatchObject({
      statusCode: status,
    });
  });
});

describe('decideDispute (money paths)', () => {
  const openDispute = {
    _id: disputeId,
    purchaseId: 'p1',
    groupId: 'g1',
    buyerId,
    sellerId,
    status: 'seller_responded',
    timeline: [],
  };
  const given = (payment, row = purchase()) => {
    jest.spyOn(Dispute, 'findById').mockReturnValue(lean(openDispute));
    jest.spyOn(Dispute, 'findOneAndUpdate').mockReturnValue(lean({ ...openDispute }));
    jest
      .spyOn(Dispute, 'findByIdAndUpdate')
      .mockReturnValue(lean({ ...openDispute, status: 'resolved' }));
    jest.spyOn(Dispute, 'updateOne').mockResolvedValue({});
    jest.spyOn(Purchase, 'findById').mockReturnValue(lean(row));
    jest.spyOn(Payment, 'findById').mockReturnValue(lean(payment));
    jest.spyOn(Purchase, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
    jest.spyOn(GroupMember, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
    jest.spyOn(SellerDue, 'updateOne').mockResolvedValue({});
  };
  const onHold = {
    _id: paymentId,
    amountPaise: 99_900,
    status: 'transferred',
    transfer: { status: 'processed' },
  };
  const released = {
    _id: paymentId,
    amountPaise: 99_900,
    status: 'transferred',
    transfer: { status: 'released' },
  };
  const withUs = { _id: paymentId, amountPaise: 99_900, status: 'paid' };
  const note = 'Dealer did not honour the winning price; invoice shows ₹4,000 extra.';

  it('token on hold: reverses the transfer, refunds the full token, cancels the code', async () => {
    given(onHold);
    await disputes.decideDispute(
      disputeId,
      { outcome: 'refund', penalties: ['rating_penalty'], note },
      staffId,
      NOW,
    );
    expect(reverseHeldTransfer).toHaveBeenCalledWith(paymentId, `dispute:${disputeId}`);
    expect(queueRefund).toHaveBeenCalledWith(paymentId, {
      reason: 'dispute_refund',
      amountPaise: 99_900,
      feePaise: 0,
    });
    expect(Purchase.updateOne.mock.calls[0][1]).toEqual({ $set: { status: 'cancelled' } });
    expect(applyPenalties).toHaveBeenCalledWith(
      sellerId,
      ['rating_penalty'],
      expect.objectContaining({ disputeId, staffId }),
    );
    expect(Dispute.findByIdAndUpdate.mock.calls[0][1].$set.decision).toMatchObject({
      outcome: 'refund',
      refundPaise: 99_900,
    });
  });

  it('token still with SaathMein: refund without a reversal', async () => {
    given(withUs);
    await disputes.decideDispute(disputeId, { outcome: 'refund', note }, staffId, NOW);
    expect(reverseHeldTransfer).not.toHaveBeenCalled();
    expect(queueRefund).toHaveBeenCalled();
  });

  it('token released: bank refund refused, credits given and billed to the dealer', async () => {
    given(released, purchase({ status: 'completed' }));
    await expect(
      disputes.decideDispute(disputeId, { outcome: 'refund', note }, staffId, NOW),
    ).rejects.toMatchObject({
      code: 'TOKEN_NOT_REFUNDABLE',
    });
    // The claim is released after a failed decision
    expect(Dispute.updateOne).toHaveBeenCalled();

    jest.restoreAllMocks();
    given(released, purchase({ status: 'completed' }));
    await disputes.decideDispute(
      disputeId,
      { outcome: 'credit', creditPaise: 99_900, note },
      staffId,
      NOW,
    );
    expect(creditWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: buyerId,
        amountPaise: 99_900,
        key: `dispute-credit:${disputeId}`,
      }),
    );
    expect(SellerDue.updateOne.mock.calls[0][1].$setOnInsert).toMatchObject({
      sellerId,
      amountPaise: 99_900,
      disputeId,
    });
    expect(queueRefund).not.toHaveBeenCalled();
  });

  it('credits only for released tokens, never above the token', async () => {
    given(onHold);
    await expect(
      disputes.decideDispute(
        disputeId,
        { outcome: 'credit', creditPaise: 10_000, note },
        staffId,
        NOW,
      ),
    ).rejects.toMatchObject({ code: 'USE_REFUND' });
    jest.restoreAllMocks();
    given(released);
    await expect(
      disputes.decideDispute(
        disputeId,
        { outcome: 'credit', creditPaise: 99_901, note },
        staffId,
        NOW,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_CREDIT' });
    expect(creditWallet).not.toHaveBeenCalled();
  });

  it('no refund: penalties only, no money moves', async () => {
    given(onHold);
    await disputes.decideDispute(
      disputeId,
      { outcome: 'no_refund', penalties: ['warning'], note },
      staffId,
      NOW,
    );
    expect(queueRefund).not.toHaveBeenCalled();
    expect(creditWallet).not.toHaveBeenCalled();
    expect(applyPenalties).toHaveBeenCalledWith(sellerId, ['warning'], expect.any(Object));
  });

  it('two staff members cannot both decide', async () => {
    given(onHold);
    Dispute.findOneAndUpdate.mockReturnValue(lean(null));
    await expect(
      disputes.decideDispute(disputeId, { outcome: 'refund', note }, staffId, NOW),
    ).rejects.toMatchObject({
      code: 'DISPUTE_DECIDED',
    });
    expect(queueRefund).not.toHaveBeenCalled();
  });

  it('a decided dispute stays decided', async () => {
    jest.spyOn(Dispute, 'findById').mockReturnValue(lean({ ...openDispute, status: 'resolved' }));
    await expect(
      disputes.decideDispute(disputeId, { outcome: 'refund', note }, staffId, NOW),
    ).rejects.toMatchObject({
      code: 'DISPUTE_DECIDED',
    });
  });
});

describe('48 h dealer SLA', () => {
  it('escalates disputes the dealer did not answer in time', async () => {
    jest.spyOn(Dispute, 'find').mockReturnValue(lean([{ _id: 'a' }, { _id: 'b' }]));
    const update = jest.spyOn(Dispute, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
    expect(await disputes.processDisputeDeadlines(NOW)).toBe(2);
    expect(update.mock.calls[0][0]).toEqual({ _id: 'a', status: 'awaiting_seller' });
    expect(update.mock.calls[0][1].$set.status).toBe('seller_missed');
  });

  it('a late answer is recorded and the dispute moves on to Support', async () => {
    jest
      .spyOn(Dispute, 'findOne')
      .mockReturnValue(
        lean({
          _id: disputeId,
          buyerId,
          sellerId,
          groupId: 'g',
          status: 'seller_missed',
          timeline: [],
        }),
      );
    const update = jest
      .spyOn(Dispute, 'findOneAndUpdate')
      .mockReturnValue(lean({ _id: disputeId }));
    jest.spyOn(Group, 'findById').mockReturnValue(lean(null));
    jest.spyOn(User, 'findById').mockReturnValue(lean({ name: 'Asha Patil' }));
    await disputes.respondToDispute(
      { sellerId, userId: 'u' },
      disputeId,
      { text: 'We charged the RTO fee separately.' },
      NOW,
    );
    expect(update.mock.calls[0][1].$set.status).toBe('seller_responded');
    expect(update.mock.calls[0][1].$push.timeline.action).toBe('responded_late');
  });
});

describe('tokenState', () => {
  it.each([
    [null, 'none'],
    [{ status: 'paid' }, 'with_saathmein'],
    [{ status: 'transferred', transfer: { status: 'pending' } }, 'on_hold'],
    [{ status: 'transferred', transfer: { status: 'released' } }, 'released'],
    [{ status: 'refunded' }, 'refunded'],
  ])('%j → %s', (payment, state) => {
    expect(disputes.tokenState(payment)).toBe(state);
  });
});
