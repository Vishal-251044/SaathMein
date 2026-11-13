/**
 * Purchases (PUR-1 to PUR-4, PAY-4): signed deal-code QR; dealer confirm completes once,
 * records the commission and releases the Route hold; expired / used / other dealers'
 * codes are refused; the invoice path completes after 48 h unless the dealer objects; an
 * unused code expires with a refund minus the back-out fee (decided 9 Nov 2026); failed
 * hold releases are retried; the group moves won → purchasing → completed.
 */
jest.mock('../../../src/utils/transaction', () => ({
  withTransaction: jest.fn(async (work) => work({ id: 'session' })),
}));
jest.mock('../../../src/services/settings.service', () => ({
  getPurchaseSettings: jest.fn(async () => ({
    invoiceObjectionHours: 48,
    expiryReminderHours: 48,
    sellerDealValidityDays: 15,
  })),
  getBillingSettings: jest.fn(),
}));
jest.mock('../../../src/services/groups/stateMachine', () => ({
  transition: jest.fn(async (group, to) => ({ ...group, status: to })),
}));
jest.mock('../../../src/services/groups/groupLive', () => ({ notifyAboutGroup: jest.fn() }));
jest.mock('../../../src/services/auction/winner.service', () => ({ notifyDealer: jest.fn() }));
jest.mock('../../../src/services/payments/route.service', () => ({
  createHeldTransfer: jest.fn(async () => ({ outcome: 'created' })),
  releaseHold: jest.fn(async () => ({ outcome: 'released' })),
  reverseHeldTransfer: jest.fn(async () => ({ outcome: 'reversed' })),
}));
jest.mock('../../../src/services/payments/refund.service', () => ({
  queueRefund: jest.fn(async () => true),
  REFUND_REASON: { PRICE_VALIDITY_EXPIRED: 'price_validity_expired' },
}));
jest.mock('../../../src/services/trust/dispute.service', () => ({
  purchasesUnderDispute: jest.fn(async () => []),
  openFromInvoiceObjection: jest.fn(async () => ({})),
}));
jest.mock('../../../src/services/upload.service', () => ({
  createInvoiceUploadParams: jest.fn(() => ({ uploadUrl: 'u', fields: {} })),
  verifyInvoiceUpload: jest.fn(),
  privateFileUrl: jest.fn(() => 'https://signed'),
}));

const { Types } = require('mongoose');
const Group = require('../../../src/models/group.model');
const GroupMember = require('../../../src/models/groupMember.model');
const Payment = require('../../../src/models/payment.model');
const Purchase = require('../../../src/models/purchase.model');
const Category = require('../../../src/models/category.model');
const Product = require('../../../src/models/product.model');
const Commission = require('../../../src/models/commission.model');
const route = require('../../../src/services/payments/route.service');
const { queueRefund } = require('../../../src/services/payments/refund.service');
const { transition } = require('../../../src/services/groups/stateMachine');
const { notifyDealer } = require('../../../src/services/auction/winner.service');
const {
  qrPayloadFor,
  parseDealCodeInput,
} = require('../../../src/services/auction/dealCode.service');
const purchases = require('../../../src/services/purchases/purchase.service');

const NOW = new Date('2026-11-09T10:00:00Z');
const HOUR = 3_600_000;
const sellerId = new Types.ObjectId();
const otherSeller = new Types.ObjectId();
const groupId = new Types.ObjectId();
const paymentId = new Types.ObjectId();
const userId = new Types.ObjectId();
const dealerUser = { sellerId: String(sellerId), userId: String(new Types.ObjectId()) };

/** Chainable query mock. */
const query = (value) => {
  const chain = {
    populate: () => chain,
    sort: () => chain,
    skip: () => chain,
    limit: () => chain,
    select: () => chain,
    lean: async () => value,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return chain;
};

const purchase = (overrides = {}) => ({
  _id: new Types.ObjectId(),
  groupId,
  memberId: new Types.ObjectId(),
  userId,
  sellerId,
  paymentId,
  dealCode: 'ABCDEFGH23',
  pricePaise: 8_500_000,
  tokenPaise: 99_900,
  status: 'pending',
  validUntil: new Date(NOW.getTime() + 5 * 24 * HOUR),
  ...overrides,
});
const group = {
  _id: groupId,
  status: 'won',
  categoryId: 'c1',
  cityId: 'p1',
  productId: 'prod1',
  backoutFeePaise: 9_900,
  auction: { ceilingPricePaise: 9_000_000 },
};
const heldPayment = {
  _id: paymentId,
  amountPaise: 99_900,
  status: 'transferred',
  transfer: { status: 'processed', commissionPaise: 99_900 },
};

/** Common reads for completion. */
const givenCompletion = (row, { open = 0, completed = 1 } = {}) => {
  jest.spyOn(Purchase, 'findById').mockReturnValue(query(row));
  jest.spyOn(Group, 'findById').mockImplementation(() => query(group));
  jest.spyOn(Payment, 'findById').mockReturnValue(query(heldPayment));
  jest
    .spyOn(Category, 'findById')
    .mockReturnValue(query({ commission: { type: 'flat', value: 100_000 } }));
  jest.spyOn(Product, 'findById').mockReturnValue(query({ brand: 'Honda', model: 'Activa' }));
  jest
    .spyOn(Purchase, 'findOneAndUpdate')
    .mockReturnValue(query({ ...row, status: 'completed', completedAt: NOW }));
  jest.spyOn(GroupMember, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
  jest.spyOn(Commission, 'updateOne').mockResolvedValue({});
  jest.spyOn(Purchase, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
  jest
    .spyOn(Purchase, 'countDocuments')
    .mockImplementation(async (filter) => (filter.status === 'completed' ? completed : open));
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('signed deal codes (PUR-1)', () => {
  it('reads a scanned QR and a typed code', () => {
    expect(parseDealCodeInput(qrPayloadFor('ABCDEFGH23'))).toEqual({
      code: 'ABCDEFGH23',
      scanned: true,
    });
    expect(parseDealCodeInput(' abcde-fgh23 ')).toEqual({ code: 'ABCDEFGH23', scanned: false });
  });

  it('rejects a QR whose signature does not match (forged or edited)', () => {
    const forged = qrPayloadFor('ABCDEFGH23').replace('ABCDEFGH23', 'ABCDEFGH24');
    expect(parseDealCodeInput(forged)).toEqual({ code: null, scanned: true });
  });
});

describe('dealer confirms a purchase (PUR-2)', () => {
  it('completes once: member purchased, commission recorded, hold released, group moves on', async () => {
    const row = purchase();
    givenCompletion(row);
    jest.spyOn(Purchase, 'findOne').mockReturnValue(query(row));

    await purchases.confirmPurchase(dealerUser, qrPayloadFor(row.dealCode), NOW);

    expect(Purchase.findOne.mock.calls[0][0]).toEqual({
      dealCode: 'ABCDEFGH23',
      sellerId: String(sellerId),
    });
    expect(Purchase.findOneAndUpdate.mock.calls[0][0]).toMatchObject({
      _id: row._id,
      status: { $in: ['pending', 'invoice_uploaded', 'objected'] },
    });
    expect(GroupMember.updateOne).toHaveBeenCalledWith(
      { _id: row.memberId, status: 'active' },
      { $set: { status: 'purchased' } },
      { session: { id: 'session' } },
    );
    // Flat ₹1,000 commission: ₹999 already kept from the token, ₹1 to invoice
    expect(Commission.updateOne.mock.calls[0][1].$setOnInsert).toMatchObject({
      commissionPaise: 100_000,
      fromTokenPaise: 99_900,
      invoicedPaise: 100,
    });
    expect(route.releaseHold).toHaveBeenCalledWith(paymentId);
    // First sale → purchasing; nothing open → completed
    expect(transition.mock.calls.map((call) => call[1])).toEqual(['purchasing', 'completed']);
  });

  it('keeps the group in purchasing while other codes are open', async () => {
    const row = purchase();
    givenCompletion(row, { open: 3 });
    jest.spyOn(Purchase, 'findOne').mockReturnValue(query(row));
    await purchases.confirmPurchase(dealerUser, row.dealCode, NOW);
    expect(transition.mock.calls.map((call) => call[1])).toEqual(['purchasing']);
  });

  it('refuses an expired code, a used code and a bad QR', async () => {
    jest
      .spyOn(Purchase, 'findOne')
      .mockReturnValueOnce(query(purchase({ validUntil: new Date(NOW.getTime() - 1) })))
      .mockReturnValueOnce(query(purchase({ status: 'completed' })));
    await expect(purchases.confirmPurchase(dealerUser, 'ABCDEFGH23', NOW)).rejects.toMatchObject({
      code: 'DEAL_CODE_EXPIRED',
    });
    await expect(purchases.confirmPurchase(dealerUser, 'ABCDEFGH23', NOW)).rejects.toMatchObject({
      code: 'ALREADY_PURCHASED',
    });
    await expect(
      purchases.confirmPurchase(dealerUser, 'SM1.ABCDEFGH23.wrongsig', NOW),
    ).rejects.toMatchObject({
      code: 'INVALID_DEAL_CODE',
    });
  });

  it("another dealer's code is not found (no hint that it exists)", async () => {
    jest.spyOn(Purchase, 'findOne').mockReturnValue(query(null));
    await expect(purchases.lookupPurchase(String(otherSeller), 'ABCDEFGH23')).rejects.toMatchObject(
      { statusCode: 404 },
    );
  });

  it('a double confirmation does not complete twice', async () => {
    const row = purchase();
    givenCompletion(row);
    Purchase.findOneAndUpdate.mockReturnValue(query(null)); // someone completed it a moment ago
    await expect(
      purchases.completePurchase(row._id, { via: 'seller', now: NOW }),
    ).rejects.toMatchObject({ code: 'PURCHASE_CLOSED' });
    expect(route.releaseHold).not.toHaveBeenCalled();
    expect(Commission.updateOne).not.toHaveBeenCalled();
  });
});

describe('invoice path (PUR-2, PUR-3)', () => {
  it('buyer invoice starts the 48 h objection window and tells the dealer', async () => {
    const row = purchase();
    jest.spyOn(Purchase, 'findOne').mockReturnValue(query(row));
    const update = jest
      .spyOn(Purchase, 'findOneAndUpdate')
      .mockReturnValue(query({ ...row, status: 'invoice_uploaded' }));
    jest.spyOn(Group, 'findById').mockReturnValue(query(group));
    jest.spyOn(Product, 'findById').mockReturnValue(query({ brand: 'Honda', model: 'Activa' }));

    await purchases.submitInvoice(
      String(userId),
      String(row._id),
      { publicId: 'x', version: 1, signature: 's' },
      NOW,
    );
    expect(update.mock.calls[0][1].$set.autoCompleteAt).toEqual(
      new Date(NOW.getTime() + 48 * HOUR),
    );
    expect(notifyDealer).toHaveBeenCalledWith(
      sellerId,
      'dealer_invoice_uploaded',
      expect.objectContaining({ hours: 48 }),
    );
  });

  it('dealer can object only before the window ends', async () => {
    jest.spyOn(Purchase, 'findOneAndUpdate').mockReturnValue(query(null));
    await expect(
      purchases.objectToInvoice(dealerUser, 'p1', 'This buyer never visited our showroom', NOW),
    ).rejects.toMatchObject({ code: 'CANNOT_OBJECT' });
    expect(Purchase.findOneAndUpdate.mock.calls[0][0]).toMatchObject({
      status: 'invoice_uploaded',
      autoCompleteAt: { $gt: NOW },
    });
  });
});

describe('minute sweep', () => {
  const givenSweep = ({ ending = [], unsettled = [], invoices = [], unreleased = [] }) => {
    jest.spyOn(Purchase, 'find').mockImplementation((filter) => {
      if (filter.reminderSentAt) return query([]);
      if (filter.status === 'pending') return query(ending);
      if (filter.status === 'expired') return query(unsettled);
      if (filter.status === 'invoice_uploaded') return query(invoices);
      return query(unreleased);
    });
    jest.spyOn(Purchase, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
    jest.spyOn(GroupMember, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
    jest.spyOn(Purchase, 'countDocuments').mockResolvedValue(1);
  };

  it('expires an unused code: takes the hold back and refunds the token minus the back-out fee', async () => {
    const row = purchase({ status: 'expired' });
    givenSweep({ ending: [purchase()], unsettled: [row] });
    jest.spyOn(Payment, 'findById').mockReturnValue(query(heldPayment));
    jest.spyOn(Group, 'findById').mockImplementation(() => query(group));

    const counts = await purchases.processPurchaseTimers(NOW);
    expect(counts).toMatchObject({ expired: 1, refunds: 1 });
    expect(route.reverseHeldTransfer).toHaveBeenCalledWith(paymentId, 'price_validity_expired');
    expect(queueRefund).toHaveBeenCalledWith(paymentId, {
      reason: 'price_validity_expired',
      amountPaise: 90_000,
      feePaise: 9_900,
    });
    expect(GroupMember.updateOne).toHaveBeenCalledWith(
      { _id: row.memberId, status: 'active' },
      { $set: { status: 'refunded', leftAt: expect.any(Date) } },
    );
  });

  it('a failed reversal leaves the refund for the next run (nothing marked done)', async () => {
    const row = purchase({ status: 'expired' });
    givenSweep({ unsettled: [row] });
    jest.spyOn(Payment, 'findById').mockReturnValue(query(heldPayment));
    jest.spyOn(Group, 'findById').mockImplementation(() => query(group));
    route.reverseHeldTransfer.mockRejectedValueOnce(new Error('Razorpay down'));

    const counts = await purchases.processPurchaseTimers(NOW);
    expect(counts.refunds).toBe(0);
    expect(queueRefund).not.toHaveBeenCalled();
    expect(Purchase.updateOne).not.toHaveBeenCalledWith(
      { _id: row._id },
      { $set: { refundQueuedAt: expect.any(Date) } },
    );
  });

  it('completes invoices whose 48 h passed without objection', async () => {
    const row = purchase({
      status: 'invoice_uploaded',
      autoCompleteAt: new Date(NOW.getTime() - 1),
    });
    givenSweep({ invoices: [row] });
    givenCompletion(row);
    Purchase.find.mockImplementation((filter) =>
      filter.status === 'invoice_uploaded' ? query([row]) : query([]),
    );
    const counts = await purchases.processPurchaseTimers(NOW);
    expect(counts.autoCompleted).toBe(1);
    expect(Purchase.findOneAndUpdate.mock.calls[0][1].$set).toMatchObject({
      completedVia: 'invoice',
    });
  });

  it('retries a hold release; creates the held transfer first if the win-time one failed', async () => {
    const row = purchase({ status: 'completed' });
    givenSweep({ unreleased: [row] });
    jest
      .spyOn(Payment, 'findById')
      .mockReturnValue(query({ _id: paymentId, amountPaise: 99_900, status: 'paid' }));
    jest.spyOn(Group, 'findById').mockReturnValue(query(group));
    jest
      .spyOn(Category, 'findById')
      .mockReturnValue(query({ commission: { type: 'percent', value: 300 } }));

    const counts = await purchases.processPurchaseTimers(NOW);
    expect(counts.released).toBe(1);
    expect(route.createHeldTransfer).toHaveBeenCalledWith(paymentId, {
      sellerId,
      pricePerUnitPaise: 8_500_000,
      commissionRule: { type: 'percent', value: 300 },
    });
    expect(route.releaseHold).toHaveBeenCalledWith(paymentId);
  });
});

describe('buyer view', () => {
  it('shows the QR only for open codes, the amount to pay at the shop and the saving', () => {
    const view = purchases.toBuyerPurchase(purchase(), group);
    expect(view).toMatchObject({
      qrPayload: qrPayloadFor('ABCDEFGH23'),
      payAtShopPaise: 8_400_100,
      savedPaise: 500_000,
      canReview: false,
    });
    expect(purchases.toBuyerPurchase(purchase({ status: 'completed' }), group)).toMatchObject({
      qrPayload: null,
      canReview: true,
    });
  });

  it('lists my deal codes with what was bought and from which dealer', async () => {
    jest.spyOn(Purchase, 'find').mockReturnValue({
      sort: () => ({ limit: () => ({ lean: async () => [purchase()] }) }),
    });
    const populated = {
      ...group,
      _id: groupId,
      productId: { brand: 'Honda', model: 'Activa 6G' },
      sellerId: { businessName: 'Pune Motors' },
    };
    const chain = { select: () => chain, populate: () => chain, lean: async () => [populated] };
    jest.spyOn(Group, 'find').mockReturnValue(chain);
    const [item] = await purchases.listMyDealCodes(String(userId));
    expect(item).toMatchObject({
      dealCode: 'ABCDEFGH23',
      productName: 'Honda Activa 6G',
      dealerName: 'Pune Motors',
    });
  });
});
