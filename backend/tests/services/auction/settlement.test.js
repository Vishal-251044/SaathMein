/**
 * Token settlement after a win (PAY-4): held transfers for every seated member's paid
 * token (skipped for groups not won, retried when one fails), reversals for back-outs and
 * groups that end, and the minute sweep that retries missing holds.
 */
jest.mock('../../../src/services/payments/route.service', () => ({
  createHeldTransfer: jest.fn(),
  reverseHeldTransfer: jest.fn(),
}));

const { Types } = require('mongoose');
const Group = require('../../../src/models/group.model');
const GroupMember = require('../../../src/models/groupMember.model');
const Payment = require('../../../src/models/payment.model');
const Category = require('../../../src/models/category.model');
const route = require('../../../src/services/payments/route.service');
const settlement = require('../../../src/services/auction/settlement.service');

const groupId = new Types.ObjectId();
const sellerId = new Types.ObjectId();
const lean = (value) => ({
  lean: async () => value,
  select: () => ({ lean: async () => value, limit: () => ({ lean: async () => value }) }),
});
const COMMISSION = { type: 'percent', value: 200 };

const givenWonGroup = (status = 'won', payments = []) => {
  jest
    .spyOn(Group, 'findById')
    .mockReturnValue(
      lean({ _id: groupId, status, sellerId, winningPricePaise: 8_500_000, categoryId: 'c1' }),
    );
  jest.spyOn(Category, 'findById').mockReturnValue(lean({ commission: COMMISSION }));
  jest
    .spyOn(GroupMember, 'find')
    .mockReturnValue(lean(payments.map((payment) => ({ paymentId: payment._id }))));
  jest.spyOn(Payment, 'find').mockReturnValue(lean(payments));
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('holdGroupTransfers', () => {
  it('holds every seated paid token at the winning price and category commission', async () => {
    const payments = [{ _id: new Types.ObjectId() }, { _id: new Types.ObjectId() }];
    givenWonGroup('won', payments);
    route.createHeldTransfer.mockResolvedValue({ outcome: 'created' });

    expect(await settlement.holdGroupTransfers(groupId)).toEqual({ created: 2, failed: 0 });
    expect(route.createHeldTransfer).toHaveBeenCalledWith(payments[0]._id, {
      sellerId,
      pricePerUnitPaise: 8_500_000,
      commissionRule: COMMISSION,
    });
    // Only paid tokens (not refunded, not already transferred)
    expect(Payment.find.mock.calls[0][0].status).toBe('paid');
  });

  it('keeps going when one transfer fails (retried by the sweep)', async () => {
    const payments = [{ _id: new Types.ObjectId() }, { _id: new Types.ObjectId() }];
    givenWonGroup('purchasing', payments);
    route.createHeldTransfer
      .mockRejectedValueOnce(
        Object.assign(new Error('no account'), { code: 'PAYOUT_ACCOUNT_REQUIRED' }),
      )
      .mockResolvedValueOnce({ outcome: 'created' });
    expect(await settlement.holdGroupTransfers(groupId)).toEqual({ created: 1, failed: 1 });
  });

  it('does nothing for groups that are not won', async () => {
    givenWonGroup('auction_live', [{ _id: new Types.ObjectId() }]);
    expect(await settlement.holdGroupTransfers(groupId)).toEqual({ created: 0, failed: 0 });
    expect(route.createHeldTransfer).not.toHaveBeenCalled();
  });

  it('the safe variant never throws', async () => {
    jest.spyOn(Group, 'findById').mockImplementation(() => {
      throw new Error('db down');
    });
    await expect(settlement.holdGroupTransfersSafe(groupId)).resolves.toBeUndefined();
  });
});

describe('reverseGroupTransfers', () => {
  it('reverses every live held transfer of the group', async () => {
    const payments = [{ _id: new Types.ObjectId() }, { _id: new Types.ObjectId() }];
    jest.spyOn(Payment, 'find').mockReturnValue(lean(payments));
    route.reverseHeldTransfer
      .mockResolvedValueOnce({ outcome: 'reversed' })
      .mockRejectedValueOnce(new Error('Razorpay down'));

    expect(await settlement.reverseGroupTransfers(groupId, 'dealer_backed_out')).toEqual({
      reversed: 1,
      failed: 1,
    });
    expect(Payment.find.mock.calls[0][0]).toMatchObject({
      groupId,
      status: 'transferred',
      'transfer.status': { $in: ['pending', 'processed'] },
    });
    expect(route.reverseHeldTransfer).toHaveBeenCalledWith(payments[0]._id, 'dealer_backed_out');
  });
});

describe('retryMissingHolds', () => {
  it('retries groups whose seated members still have paid (untransferred) tokens', async () => {
    jest.spyOn(Group, 'find').mockReturnValue(lean([{ _id: groupId }]));
    jest.spyOn(GroupMember, 'find').mockReturnValue(lean([{ paymentId: 'p1' }]));
    jest.spyOn(Payment, 'distinct').mockResolvedValue([groupId]);
    const hold = jest.spyOn(Group, 'findById').mockReturnValue(lean(null)); // group gone → no-op
    expect(await settlement.retryMissingHolds()).toBe(0);
    expect(hold).toHaveBeenCalledWith(groupId);
  });

  it('does nothing when no group is won', async () => {
    jest.spyOn(Group, 'find').mockReturnValue(lean([]));
    const distinct = jest.spyOn(Payment, 'distinct');
    expect(await settlement.retryMissingHolds()).toBe(0);
    expect(distinct).not.toHaveBeenCalled();
  });
});
