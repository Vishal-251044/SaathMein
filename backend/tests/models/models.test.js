/**
 * Schema tests for the base models (no database needed — uses validate() and
 * query middleware, which run before anything is sent to MongoDB).
 */
const { Types } = require('mongoose');
const { Ledger, Bid, Payment, Group, User } = require('../../src/models');
const { LEDGER_TYPE, GROUP_STATUS, GROUP_TYPE } = require('../../src/constants/enums');

const id = () => new Types.ObjectId();

/**
 * Run async validation and return the ValidationError (or undefined when valid).
 * @param {import('mongoose').Document} doc - Document to validate
 * @returns {Promise<import('mongoose').Error.ValidationError|undefined>}
 */
const validationErrorOf = (doc) =>
  doc.validate().then(
    () => undefined,
    (err) => err,
  );

describe('base models', () => {
  it('rejects non-integer paise amounts', async () => {
    const payment = new Payment({
      userId: id(),
      groupId: id(),
      razorpayOrderId: 'order_test_1',
      amountPaise: 999.5,
    });
    const err = await validationErrorOf(payment);
    expect(err.errors.amountPaise.message).toMatch(/integer amount in paise/);
  });

  it('defaults a new group to "open" and rejects unknown statuses', async () => {
    const base = {
      type: GROUP_TYPE.BUYER_LED,
      productId: id(),
      categoryId: id(),
      cityId: id(),
      targetSize: 20,
      tokenAmountPaise: 100000,
      deadline: new Date(Date.now() + 86400000),
    };
    expect(new Group(base).status).toBe(GROUP_STATUS.OPEN);
    const err = await validationErrorOf(new Group({ ...base, status: 'bidding' }));
    expect(err.errors.status).toBeDefined();
  });

  it('validates phone numbers in E.164 format', async () => {
    expect((await validationErrorOf(new User({ phone: '9876543210' }))).errors.phone).toBeDefined();
    expect(await validationErrorOf(new User({ phone: '+919876543210' }))).toBeUndefined();
  });

  it('ledger is append-only: updates and deletes are rejected', async () => {
    await expect(Ledger.updateOne({}, { amountPaise: 1 })).rejects.toThrow(/append-only/);
    await expect(Ledger.deleteMany({})).rejects.toThrow(/append-only/);
  });

  it('ledger rejects unknown entry types', async () => {
    expect(
      (await validationErrorOf(new Ledger({ type: 'gift', amountPaise: 100 }))).errors.type,
    ).toBeDefined();
    expect(
      await validationErrorOf(new Ledger({ type: LEDGER_TYPE.TOKEN_HELD, amountPaise: 100 })),
    ).toBeUndefined();
  });

  it('bids can never be deleted, and their price is immutable', async () => {
    await expect(Bid.deleteOne({})).rejects.toThrow(/append-only/);

    const bid = new Bid({
      groupId: id(),
      sellerId: id(),
      pricePerUnitPaise: 8850000,
      breakdown: { basePaise: 8000000 },
      validTill: new Date(),
    });
    bid.$isNew = false; // simulate a saved bid
    bid.pricePerUnitPaise = 100;
    expect(bid.pricePerUnitPaise).toBe(8850000);
  });
});
