/**
 * Token payments (PAY-1, PAY-2): order amount comes from the group (never the app), join
 * rules, seat holds; the one join path — payment + ledger + member + count in one
 * transaction, idempotent for duplicates, the last seat locks the group, a late payment
 * with no seat is refunded; Checkout signature check; payment.failed frees the hold.
 */
jest.mock('../../../src/models/group.model', () => ({
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../../../src/models/groupMember.model', () => ({
  findOne: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../../../src/models/payment.model', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
  countDocuments: jest.fn(async () => 0),
  create: jest.fn(async (doc) => doc),
}));
jest.mock('../../../src/models/user.model', () => ({ findById: jest.fn() }));
jest.mock('../../../src/models/product.model', () => ({ findById: jest.fn() }));
jest.mock('../../../src/utils/transaction', () => ({
  withTransaction: jest.fn(async (work) => work({ id: 'session' })),
}));
jest.mock('../../../src/services/rateLimit.service', () => ({ assertWithinLimit: jest.fn() }));
jest.mock('../../../src/services/settings.service', () => ({
  getPaymentSettings: jest.fn(async () => ({ seatReservationMinutes: 15, waitlistOfferHours: 2 })),
  getGroupSettings: jest.fn(async () => ({})),
}));
jest.mock('../../../src/services/payments/razorpay.service', () => ({
  createOrder: jest.fn(),
  fetchPayment: jest.fn(),
  capturePayment: jest.fn(),
  verifyPaymentSignature: jest.fn(() => true),
}));
jest.mock('../../../src/services/payments/ledger.service', () => ({ recordLedger: jest.fn() }));
jest.mock('../../../src/services/payments/refund.service', () => ({
  queueRefund: jest.fn(),
  REFUND_REASON: { SEAT_UNAVAILABLE: 'seat_unavailable', AMOUNT_MISMATCH: 'amount_mismatch' },
}));
jest.mock('../../../src/services/groups/stateMachine', () => ({
  transition: jest.fn(async (g) => ({ ...g, status: 'full' })),
}));
jest.mock('../../../src/services/groups/groupEffects', () => ({ runGroupEffects: jest.fn() }));

const { Types } = require('mongoose');
const Group = require('../../../src/models/group.model');
const GroupMember = require('../../../src/models/groupMember.model');
const Payment = require('../../../src/models/payment.model');
const User = require('../../../src/models/user.model');
const Product = require('../../../src/models/product.model');
const razorpay = require('../../../src/services/payments/razorpay.service');
const { recordLedger } = require('../../../src/services/payments/ledger.service');
const { queueRefund } = require('../../../src/services/payments/refund.service');
const { transition } = require('../../../src/services/groups/stateMachine');
const { runGroupEffects } = require('../../../src/services/groups/groupEffects');
const payments = require('../../../src/services/payments/payment.service');

const userId = new Types.ObjectId().toString();
const groupId = new Types.ObjectId().toString();

const lean = (value) => ({ lean: async () => value, select: () => ({ lean: async () => value }) });
const group = (overrides = {}) => ({
  _id: groupId,
  status: 'open',
  visibility: 'public',
  memberCount: 3,
  targetSize: 10,
  tokenAmountPaise: 100_000,
  deadline: new Date(Date.now() + 86_400_000),
  productId: new Types.ObjectId(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  User.findById.mockReturnValue(lean({ name: 'Asha', phone: '+919876543210' }));
  Product.findById.mockReturnValue(lean({ brand: 'Honda', model: 'Activa 6G' }));
  GroupMember.findOne.mockReturnValue(lean(null));
  Payment.findOne.mockReturnValue(lean(null));
});

describe('createTokenOrder', () => {
  it('creates the order with the group token amount and holds a seat for 15 minutes', async () => {
    Group.findById.mockReturnValue(lean(group()));
    razorpay.createOrder.mockResolvedValue({ id: 'order_ABC', amount: 100_000 });

    const checkout = await payments.createTokenOrder(userId, { groupId });

    expect(razorpay.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amountPaise: 100_000 }),
    );
    expect(Payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        razorpayOrderId: 'order_ABC',
        amountPaise: 100_000,
        status: 'created',
        userId,
        groupId,
      }),
    );
    const { reservedUntil } = Payment.create.mock.calls[0][0];
    expect(reservedUntil.getTime() - Date.now()).toBeGreaterThan(14 * 60_000);
    expect(checkout).toMatchObject({
      orderId: 'order_ABC',
      amountPaise: 100_000,
      keyId: 'rzp_test_saathmein',
    });
    expect(checkout).not.toHaveProperty('keySecret');
  });

  it('reuses the open checkout when the buyer taps Join again', async () => {
    Group.findById.mockReturnValue(lean(group()));
    Payment.findOne.mockReturnValue(
      lean({ _id: new Types.ObjectId(), razorpayOrderId: 'order_OLD', amountPaise: 100_000 }),
    );
    const checkout = await payments.createTokenOrder(userId, { groupId });
    expect(checkout.orderId).toBe('order_OLD');
    expect(razorpay.createOrder).not.toHaveBeenCalled();
  });

  it.each([
    [
      'already a member',
      () => GroupMember.findOne.mockReturnValue(lean({ status: 'active' })),
      group(),
      'ALREADY_MEMBER',
    ],
    ['group full (no offer)', () => {}, group({ status: 'full', memberCount: 10 }), 'GROUP_FULL'],
    ['group closed', () => {}, group({ status: 'expired' }), 'GROUP_CLOSED'],
    [
      'remaining seats in checkout',
      () => Payment.countDocuments.mockResolvedValueOnce(7),
      group(),
      'SEATS_RESERVED',
    ],
  ])('refuses: %s', async (_label, setup, groupDoc, code) => {
    setup();
    Group.findById.mockReturnValue(lean(groupDoc));
    await expect(payments.createTokenOrder(userId, { groupId })).rejects.toMatchObject({ code });
    expect(razorpay.createOrder).not.toHaveBeenCalled();
  });

  it('lets a waitlisted buyer with a live seat offer pay for a full group', async () => {
    GroupMember.findOne.mockReturnValue(
      lean({ status: 'waitlisted', offerExpiresAt: new Date(Date.now() + 3_600_000) }),
    );
    Group.findById.mockReturnValue(lean(group({ status: 'full', memberCount: 9 })));
    razorpay.createOrder.mockResolvedValue({ id: 'order_W', amount: 100_000 });
    await expect(payments.createTokenOrder(userId, { groupId })).resolves.toMatchObject({
      orderId: 'order_W',
    });
  });

  it('needs an invite code or approval for community groups', async () => {
    Group.findById.mockReturnValue(
      lean(group({ visibility: 'community', inviteCode: 'K7M2QX9P' })),
    );
    await expect(payments.createTokenOrder(userId, { groupId })).rejects.toMatchObject({
      statusCode: 404,
    });
    Group.findById.mockReturnValue(
      lean(group({ visibility: 'community', requiresApproval: true })),
    );
    await expect(
      payments.createTokenOrder(userId, { groupId, code: 'K7M2QX9P' }),
    ).rejects.toMatchObject({ code: 'APPROVAL_REQUIRED' });
  });
});

describe('confirmCapturedPayment (the join path)', () => {
  const payment = {
    _id: new Types.ObjectId(),
    userId,
    groupId,
    razorpayOrderId: 'order_ABC',
    amountPaise: 100_000,
    status: 'created',
  };
  const entity = {
    id: 'pay_XYZ',
    order_id: 'order_ABC',
    amount: 100_000,
    currency: 'INR',
    method: 'upi',
    status: 'captured',
    fee: 2_360,
    tax: 360,
    created_at: 1_700_000_000,
  };

  const paidDoc = () => ({ ...payment, _id: payment._id, status: 'paid' });

  it('marks paid, writes token_held, takes a seat and adds the member — in one transaction', async () => {
    Payment.findOneAndUpdate.mockResolvedValue(paidDoc());
    GroupMember.findOne.mockReturnValue({ session: async () => null });
    Group.findOneAndUpdate.mockResolvedValue(group({ memberCount: 4 }));

    expect(await payments.confirmCapturedPayment(payment, entity)).toEqual({
      outcome: 'joined',
      groupId,
    });

    const [filter, update, options] = Payment.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: payment._id, status: { $in: ['created', 'failed'] } });
    expect(update.$set).toMatchObject({
      status: 'paid',
      razorpayPaymentId: 'pay_XYZ',
      razorpayFeePaise: 2_360,
    });
    expect(options.session).toEqual({ id: 'session' });
    expect(recordLedger).toHaveBeenCalledWith(
      [expect.objectContaining({ type: 'token_held', amountPaise: 100_000, ref: 'pay_XYZ' })],
      { id: 'session' },
    );
    expect(Group.findOneAndUpdate.mock.calls[0][1]).toEqual({ $inc: { memberCount: 1 } });
    expect(GroupMember.updateOne).toHaveBeenCalledWith(
      { groupId, userId },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'active', paymentId: payment._id }),
      }),
      { upsert: true, session: { id: 'session' } },
    );
    expect(transition).not.toHaveBeenCalled();
    expect(queueRefund).not.toHaveBeenCalled();
  });

  it('ignores a duplicate (webhook after verify): no second ledger entry or seat', async () => {
    Payment.findOneAndUpdate.mockResolvedValue(null);
    expect(await payments.confirmCapturedPayment(payment, entity)).toEqual({
      outcome: 'already_processed',
      groupId,
    });
    expect(recordLedger).not.toHaveBeenCalled();
    expect(Group.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('locks the group when the last seat is taken (state machine, effects after commit)', async () => {
    Payment.findOneAndUpdate.mockResolvedValue(paidDoc());
    GroupMember.findOne.mockReturnValue({ session: async () => null });
    Group.findOneAndUpdate.mockResolvedValue(group({ memberCount: 10 }));
    await payments.confirmCapturedPayment(payment, entity);
    expect(transition).toHaveBeenCalledWith(expect.objectContaining({ memberCount: 10 }), 'full', {
      reason: 'target_reached',
      session: { id: 'session' },
    });
    expect(runGroupEffects).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'full' }),
      'open',
    );
  });

  it('refunds in full when the payment arrives after the last seat was taken', async () => {
    Payment.findOneAndUpdate.mockResolvedValue(paidDoc());
    GroupMember.findOne.mockReturnValue({ session: async () => null });
    Group.findOneAndUpdate.mockResolvedValue(null);
    expect(await payments.confirmCapturedPayment(payment, entity)).toEqual({
      outcome: 'seat_unavailable',
      groupId,
    });
    expect(GroupMember.updateOne).not.toHaveBeenCalled();
    expect(queueRefund).toHaveBeenCalledWith(payment._id, { reason: 'seat_unavailable' });
  });

  it('does not seat a payment whose amount does not match the order, and refunds it', async () => {
    Payment.findOneAndUpdate.mockResolvedValue(paidDoc());
    expect(await payments.confirmCapturedPayment(payment, { ...entity, amount: 1_000 })).toEqual({
      outcome: 'mismatch',
      groupId,
    });
    expect(Group.findOneAndUpdate).not.toHaveBeenCalled();
    expect(recordLedger).toHaveBeenCalledWith(
      [expect.objectContaining({ type: 'token_held', amountPaise: 1_000 })],
      { id: 'session' },
    );
    expect(queueRefund).toHaveBeenCalledWith(payment._id, { reason: 'amount_mismatch' });
  });
});

describe('verifyCheckout and failures', () => {
  const input = { orderId: 'order_ABC', razorpayPaymentId: 'pay_XYZ', signature: 'a'.repeat(64) };
  const payment = {
    _id: new Types.ObjectId(),
    userId,
    groupId,
    razorpayOrderId: 'order_ABC',
    amountPaise: 100_000,
    status: 'created',
  };

  it('rejects a bad signature without touching Razorpay', async () => {
    Payment.findOne.mockReturnValue(lean(payment));
    razorpay.verifyPaymentSignature.mockReturnValueOnce(false);
    await expect(payments.verifyCheckout(userId, input)).rejects.toMatchObject({
      code: 'INVALID_SIGNATURE',
    });
    expect(razorpay.fetchPayment).not.toHaveBeenCalled();
  });

  it('captures an authorized payment, then joins', async () => {
    Payment.findOne.mockReturnValue(lean(payment));
    razorpay.fetchPayment.mockResolvedValue({
      id: 'pay_XYZ',
      order_id: 'order_ABC',
      status: 'authorized',
    });
    razorpay.capturePayment.mockResolvedValue({
      id: 'pay_XYZ',
      order_id: 'order_ABC',
      amount: 100_000,
      currency: 'INR',
      status: 'captured',
    });
    Payment.findOneAndUpdate.mockResolvedValue({ ...payment, status: 'paid' });
    GroupMember.findOne.mockReturnValue({ session: async () => null });
    Group.findOneAndUpdate.mockResolvedValue(group({ memberCount: 4 }));
    expect((await payments.verifyCheckout(userId, input)).outcome).toBe('joined');
    expect(razorpay.capturePayment).toHaveBeenCalledWith('pay_XYZ', 100_000);
  });

  it('leaves a still-pending UPI payment to the webhook', async () => {
    Payment.findOne.mockReturnValue(lean(payment));
    razorpay.fetchPayment.mockResolvedValue({
      id: 'pay_XYZ',
      order_id: 'order_ABC',
      status: 'created',
    });
    expect((await payments.verifyCheckout(userId, input)).outcome).toBe('processing');
  });

  it('payment.failed frees the seat hold and adds no member', async () => {
    expect(
      await payments.handlePaymentFailed({
        order_id: 'order_ABC',
        error_description: 'Payment declined',
      }),
    ).toBe(true);
    expect(Payment.updateOne).toHaveBeenCalledWith(
      { razorpayOrderId: 'order_ABC', status: 'created' },
      {
        $set: { status: 'failed', failureReason: 'Payment declined' },
        $unset: { reservedUntil: 1 },
      },
    );
    expect(GroupMember.updateOne).not.toHaveBeenCalled();
  });
});
