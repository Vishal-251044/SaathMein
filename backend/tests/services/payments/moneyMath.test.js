/**
 * Money building blocks (PAY-1, PAY-4, PAY-5): Razorpay signature checks, commission split
 * of a token, ledger amounts (integer paise only) and the held-balance arithmetic.
 */
jest.mock('../../../src/models/ledger.model', () => ({ create: jest.fn(async (rows) => rows) }));

const crypto = require('crypto');
const Ledger = require('../../../src/models/ledger.model');
const {
  verifyPaymentSignature,
  verifyWebhookSignature,
} = require('../../../src/services/payments/razorpay.service');
const { splitToken, commissionForUnit } = require('../../../src/services/payments/commission');
const { recordLedger, heldBalance } = require('../../../src/services/payments/ledger.service');

const hmac = (value, secret) => crypto.createHmac('sha256', secret).update(value).digest('hex');

describe('signatures', () => {
  it('accepts the Checkout signature made with the key secret only', () => {
    const signature = hmac('order_A|pay_B', 'test-razorpay-key-secret');
    expect(verifyPaymentSignature({ orderId: 'order_A', paymentId: 'pay_B', signature })).toBe(
      true,
    );
    expect(verifyPaymentSignature({ orderId: 'order_A', paymentId: 'pay_C', signature })).toBe(
      false,
    );
    const webhookSigned = hmac('order_A|pay_B', 'test-razorpay-webhook-secret');
    expect(
      verifyPaymentSignature({ orderId: 'order_A', paymentId: 'pay_B', signature: webhookSigned }),
    ).toBe(false);
    expect(verifyPaymentSignature({ orderId: 'order_A', paymentId: 'pay_B', signature: '' })).toBe(
      false,
    );
  });

  it('checks webhooks against the exact raw bytes with the webhook secret', () => {
    const raw = Buffer.from('{"event":"payment.captured","payload":{}}');
    const signature = hmac(raw, 'test-razorpay-webhook-secret');
    expect(verifyWebhookSignature(raw, signature)).toBe(true);
    // Re-serialised JSON (different bytes) must fail
    const reformatted = Buffer.from('{"event": "payment.captured","payload":{}}');
    expect(verifyWebhookSignature(reformatted, signature)).toBe(false);
    expect(verifyWebhookSignature(raw, hmac(raw, 'test-razorpay-key-secret'))).toBe(false);
    expect(verifyWebhookSignature(raw, undefined)).toBe(false);
  });
});

describe('commission split', () => {
  it('takes a flat commission (cars ₹5,000) from a ₹20,000 token', () => {
    expect(
      splitToken({
        tokenPaise: 2_000_000,
        pricePerUnitPaise: 105_000_000,
        rule: { type: 'flat', value: 500_000 },
      }),
    ).toEqual({
      commissionPaise: 500_000,
      fromTokenPaise: 500_000,
      invoicedPaise: 0,
      transferPaise: 1_500_000,
    });
  });

  it('takes a percentage (3% of ₹75,000) and invoices what the token cannot cover', () => {
    expect(commissionForUnit({ type: 'percent', value: 300 }, 7_500_000)).toBe(225_000);
    expect(
      splitToken({
        tokenPaise: 50_000,
        pricePerUnitPaise: 7_500_000,
        rule: { type: 'percent', value: 300 },
      }),
    ).toEqual({
      commissionPaise: 225_000,
      fromTokenPaise: 50_000,
      invoicedPaise: 175_000,
      transferPaise: 0,
    });
  });

  it('rounds percentages to whole paise and rejects rupee floats', () => {
    expect(commissionForUnit({ type: 'percent', value: 250 }, 999_999)).toBe(25_000);
    expect(commissionForUnit(null, 999_999)).toBe(0);
    expect(() => splitToken({ tokenPaise: 99.5, pricePerUnitPaise: 100, rule: null })).toThrow(
      TypeError,
    );
  });
});

describe('ledger', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes only integer paise and skips zero rows', async () => {
    await recordLedger([
      { type: 'refund', amountPaise: 90_100 },
      { type: 'fee', amountPaise: 0 },
    ]);
    expect(Ledger.create).toHaveBeenCalledWith([{ type: 'refund', amountPaise: 90_100 }], {
      session: undefined,
      ordered: true,
    });
    await expect(recordLedger([{ type: 'refund', amountPaise: 10.5 }])).rejects.toThrow(TypeError);
    await expect(recordLedger([{ type: 'refund', amountPaise: -1 }])).rejects.toThrow(TypeError);
  });

  const rows = (...pairs) => pairs.map(([type, amountPaise]) => ({ type, amountPaise }));

  it.each([
    ['open leave: full refund', rows(['token_held', 100_000], ['refund', 100_000]), 0],
    [
      'leave after lock: fee kept',
      rows(['token_held', 100_000], ['refund', 90_100], ['fee', 9_900]),
      0,
    ],
    ['still held', rows(['token_held', 100_000]), 100_000],
    [
      'sent to dealer on hold',
      rows(['token_held', 100_000], ['transfer', 50_000], ['commission', 50_000]),
      0,
    ],
    [
      'released (no money moves)',
      rows(
        ['token_held', 100_000],
        ['transfer', 50_000],
        ['commission', 50_000],
        ['hold_release', 50_000],
      ),
      0,
    ],
    [
      'reversed, then refunded',
      rows(
        ['token_held', 100_000],
        ['transfer', 50_000],
        ['commission', 50_000],
        ['transfer_reversal', 50_000],
        ['commission_reversal', 50_000],
        ['refund', 100_000],
      ),
      0,
    ],
  ])('balances: %s', (_label, entries, held) => {
    expect(heldBalance(entries)).toBe(held);
  });
});
