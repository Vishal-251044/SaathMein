/**
 * Refunds (PAY-3, CLAUDE.md §8 "every refund path"): full refund, refund minus back-out
 * fee, fee-only, never twice for the same reason, Razorpay failure marked for retry,
 * ledger written exactly once when processed, group endings refund every paid member,
 * and the retry sweep uses a new job id.
 */
jest.mock('../../../src/models/payment.model', () => ({
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
  find: jest.fn(),
}));
jest.mock('../../../src/models/groupMember.model', () => ({ updateMany: jest.fn() }));
jest.mock('../../../src/utils/transaction', () => ({
  withTransaction: jest.fn(async (work) => work({ id: 'session' })),
}));
jest.mock('../../../src/jobs/queues', () => ({ enqueueRefund: jest.fn(async () => true) }));
jest.mock('../../../src/services/payments/razorpay.service', () => ({ createRefund: jest.fn() }));
jest.mock('../../../src/services/payments/ledger.service', () => ({ recordLedger: jest.fn() }));

const { Types } = require('mongoose');
const Payment = require('../../../src/models/payment.model');
const GroupMember = require('../../../src/models/groupMember.model');
const { enqueueRefund } = require('../../../src/jobs/queues');
const razorpay = require('../../../src/services/payments/razorpay.service');
const { recordLedger } = require('../../../src/services/payments/ledger.service');
const refunds = require('../../../src/services/payments/refund.service');

const paymentId = new Types.ObjectId();
const userId = new Types.ObjectId();
const groupId = new Types.ObjectId();

const paid = (overrides = {}) => ({
  _id: paymentId,
  userId,
  groupId,
  razorpayPaymentId: 'pay_TEST1',
  amountPaise: 100_000,
  status: 'paid',
  refunds: [],
  ...overrides,
});

/** Payment.findById(...).lean() */
const givenPayment = (payment) => Payment.findById.mockReturnValue({ lean: async () => payment });

/** First findOneAndUpdate = reopen failed (none), second = claim. */
const claimSucceeds = (refund) =>
  Payment.findOneAndUpdate.mockResolvedValueOnce(null).mockResolvedValueOnce({
    ...paid(),
    refunds: [{ _id: new Types.ObjectId(), attempts: 1, ...refund }],
  });

beforeEach(() => jest.clearAllMocks());

describe('refundPayment', () => {
  it('refunds the whole token and writes the ledger when Razorpay processes it at once', async () => {
    givenPayment(paid());
    claimSucceeds({
      reason: 'group_expired',
      amountPaise: 100_000,
      feePaise: 0,
      status: 'pending',
    });
    razorpay.createRefund.mockResolvedValue({
      id: 'rfnd_1',
      status: 'processed',
      created_at: 1_700_000_000,
    });
    // markRefundProcessed flips pending → processed
    const processedDoc = {
      ...paid(),
      refunds: [
        {
          razorpayRefundId: 'rfnd_1',
          amountPaise: 100_000,
          feePaise: 0,
          reason: 'group_expired',
          status: 'processed',
        },
      ],
      save: jest.fn(),
    };
    Payment.findOneAndUpdate.mockResolvedValueOnce(processedDoc);

    expect(await refunds.refundPayment(paymentId, { reason: 'group_expired' })).toEqual({
      outcome: 'refunded',
    });
    expect(razorpay.createRefund).toHaveBeenCalledWith(
      'pay_TEST1',
      expect.objectContaining({ amountPaise: 100_000 }),
    );
    expect(processedDoc.status).toBe('refunded');
    expect(recordLedger).toHaveBeenCalledWith(
      [
        expect.objectContaining({ type: 'refund', amountPaise: 100_000, ref: 'rfnd_1' }),
        expect.objectContaining({ type: 'fee', amountPaise: 0 }),
      ],
      { id: 'session' },
    );
  });

  it('keeps the back-out fee after lock: refunds ₹901 of ₹1,000', async () => {
    givenPayment(paid());
    claimSucceeds({
      reason: 'left_after_lock',
      amountPaise: 90_100,
      feePaise: 9_900,
      status: 'pending',
    });
    razorpay.createRefund.mockResolvedValue({ id: 'rfnd_2', status: 'pending' });

    const result = await refunds.refundPayment(paymentId, {
      reason: 'left_after_lock',
      amountPaise: 90_100,
      feePaise: 9_900,
    });
    expect(result).toEqual({ outcome: 'pending' });
    const claimUpdate = Payment.findOneAndUpdate.mock.calls[1][1];
    expect(claimUpdate.$push.refunds).toMatchObject({
      amountPaise: 90_100,
      feePaise: 9_900,
      reason: 'left_after_lock',
    });
    expect(razorpay.createRefund).toHaveBeenCalledWith(
      'pay_TEST1',
      expect.objectContaining({ amountPaise: 90_100 }),
    );
    expect(recordLedger).not.toHaveBeenCalled(); // written when refund.processed arrives
  });

  it('never refunds twice for the same reason', async () => {
    givenPayment(paid());
    Payment.findOneAndUpdate.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    expect(await refunds.refundPayment(paymentId, { reason: 'group_expired' })).toEqual({
      outcome: 'already',
    });
    expect(razorpay.createRefund).not.toHaveBeenCalled();
  });

  it('never refunds more than what is left', async () => {
    givenPayment(
      paid({
        refunds: [
          { reason: 'left_open_group', amountPaise: 100_000, feePaise: 0, status: 'processed' },
        ],
      }),
    );
    expect(await refunds.refundPayment(paymentId, { reason: 'group_expired' })).toEqual({
      outcome: 'nothing_to_refund',
    });
    expect(Payment.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does nothing for unpaid or failed payments', async () => {
    givenPayment(paid({ status: 'failed', razorpayPaymentId: undefined }));
    expect(await refunds.refundPayment(paymentId, { reason: 'group_expired' })).toEqual({
      outcome: 'nothing_to_refund',
    });
  });

  it('marks the refund failed and throws when Razorpay refuses (so the job retries)', async () => {
    givenPayment(paid());
    claimSucceeds({ reason: 'no_deal', amountPaise: 100_000, feePaise: 0, status: 'pending' });
    razorpay.createRefund.mockRejectedValue(new Error('Razorpay down'));
    await expect(refunds.refundPayment(paymentId, { reason: 'no_deal' })).rejects.toThrow(
      'Razorpay down',
    );
    expect(Payment.updateOne).toHaveBeenCalledWith(expect.objectContaining({ _id: paymentId }), {
      $set: { 'refunds.$.status': 'failed', 'refunds.$.lastError': 'Razorpay down' },
    });
  });

  it('records a fee-only "refund" without calling Razorpay', async () => {
    givenPayment(paid({ amountPaise: 9_900 }));
    claimSucceeds({
      reason: 'left_after_lock',
      amountPaise: 0,
      feePaise: 9_900,
      status: 'pending',
    });
    expect(
      await refunds.refundPayment(paymentId, {
        reason: 'left_after_lock',
        amountPaise: 0,
        feePaise: 9_900,
      }),
    ).toEqual({ outcome: 'refunded' });
    expect(razorpay.createRefund).not.toHaveBeenCalled();
    expect(recordLedger).toHaveBeenCalledWith(
      [expect.objectContaining({ type: 'fee', amountPaise: 9_900 })],
      { id: 'session' },
    );
  });
});

describe('refund webhooks', () => {
  it('writes the ledger only once for repeated refund.processed', async () => {
    Payment.findOneAndUpdate.mockResolvedValueOnce(null); // already processed
    expect(await refunds.markRefundProcessed('rfnd_1')).toBe(false);
    expect(recordLedger).not.toHaveBeenCalled();
  });

  it('marks a refund failed for retry', async () => {
    expect(await refunds.markRefundFailed('rfnd_9', 'bank rejected')).toBe(true);
    expect(Payment.updateOne).toHaveBeenCalledWith(
      { refunds: { $elemMatch: { razorpayRefundId: 'rfnd_9', status: 'pending' } } },
      { $set: { 'refunds.$.status': 'failed', 'refunds.$.lastError': 'bank rejected' } },
    );
  });
});

describe('group endings and retries', () => {
  it('queues a full refund for every paid member and marks them refunded', async () => {
    const payments = [
      { _id: new Types.ObjectId() },
      { _id: new Types.ObjectId() },
      { _id: new Types.ObjectId() },
    ];
    Payment.find.mockReturnValue({ select: () => ({ lean: async () => payments }) });
    expect(await refunds.refundGroupMembers(groupId, 'group_expired')).toBe(3);
    expect(enqueueRefund).toHaveBeenCalledTimes(3);
    expect(enqueueRefund).toHaveBeenCalledWith({
      paymentId: String(payments[0]._id),
      reason: 'group_expired',
    });
    expect(GroupMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ groupId }),
      expect.objectContaining({ $set: expect.objectContaining({ status: 'refunded' }) }),
    );
  });

  it('refunds inline when Redis is not configured', async () => {
    enqueueRefund.mockResolvedValueOnce(false);
    givenPayment(
      paid({
        status: 'refunded',
        refunds: [{ reason: 'x', amountPaise: 100_000, status: 'processed' }],
      }),
    );
    await refunds.queueRefund(paymentId, { reason: 'group_expired' });
    expect(Payment.findById).toHaveBeenCalledWith(paymentId);
  });

  it('re-queues failed refunds with the next attempt number (new job id)', async () => {
    Payment.find.mockReturnValue({
      select: () => ({
        limit: () => ({
          lean: async () => [
            {
              _id: paymentId,
              refunds: [
                {
                  reason: 'no_deal',
                  amountPaise: 100_000,
                  feePaise: 0,
                  status: 'failed',
                  attempts: 2,
                },
              ],
            },
          ],
        }),
      }),
    });
    expect(await refunds.retryFailedRefunds()).toBe(1);
    expect(enqueueRefund).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'no_deal', attempt: 3 }),
    );
  });
});
