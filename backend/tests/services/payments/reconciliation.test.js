/**
 * Daily reconciliation (PAY-7): a captured token whose webhook was lost is joined through
 * the normal join path; a refund processed at Razorpay but pending here gets its ledger;
 * amount differences are reported; a Razorpay outage stores a failed report.
 */
jest.mock('../../../src/models/payment.model', () => ({ find: jest.fn(), updateOne: jest.fn() }));
jest.mock('../../../src/models/ledger.model', () => ({
  aggregate: jest.fn(async () => [{ total: 100_000 }]),
}));
jest.mock('../../../src/models/reconciliationReport.model', () => ({
  create: jest.fn(async (doc) => doc),
}));
jest.mock('../../../src/services/payments/razorpay.service', () => ({ listEntities: jest.fn() }));
jest.mock('../../../src/services/payments/payment.service', () => ({
  confirmCapturedPayment: jest.fn(),
}));
jest.mock('../../../src/services/payments/refund.service', () => ({
  markRefundProcessed: jest.fn(async () => true),
}));

const Payment = require('../../../src/models/payment.model');
const razorpay = require('../../../src/services/payments/razorpay.service');
const { confirmCapturedPayment } = require('../../../src/services/payments/payment.service');
const { markRefundProcessed } = require('../../../src/services/payments/refund.service');
const {
  runReconciliation,
  yesterdayIst,
  istDayWindow,
} = require('../../../src/services/payments/reconciliation.service');

const lean = (value) => ({ lean: async () => value, select: () => ({ lean: async () => value }) });

beforeEach(() => jest.clearAllMocks());

it('works on IST days', () => {
  expect(yesterdayIst(new Date('2026-11-08T20:00:00Z'))).toBe('2026-11-08'); // 01:30 IST on 9 Nov
  expect(istDayWindow('2026-11-08').start.toISOString()).toBe('2026-11-07T18:30:00.000Z');
});

it('auto-fixes a lost capture and a lost refund.processed; reports amount differences', async () => {
  razorpay.listEntities.mockImplementation(async (kind) =>
    kind === 'payments'
      ? {
          items: [
            {
              id: 'pay_1',
              order_id: 'order_1',
              amount: 100_000,
              status: 'captured',
              fee: 2_360,
              tax: 360,
            },
            { id: 'pay_2', order_id: 'order_2', amount: 50_000, status: 'captured' },
            { id: 'pay_x', order_id: 'order_other', amount: 1, status: 'captured' },
          ],
        }
      : { items: [{ id: 'rfnd_1', amount: 100_000, status: 'processed' }] },
  );
  Payment.find
    .mockReturnValueOnce(
      lean([
        { _id: 'p1', razorpayOrderId: 'order_1', amountPaise: 100_000, status: 'created' },
        {
          _id: 'p2',
          razorpayOrderId: 'order_2',
          amountPaise: 100_000,
          status: 'paid',
          razorpayFeePaise: 1,
        },
      ]),
    )
    .mockReturnValueOnce(
      lean([
        {
          _id: 'p3',
          refunds: [{ razorpayRefundId: 'rfnd_1', amountPaise: 100_000, status: 'pending' }],
        },
      ]),
    );

  const report = await runReconciliation({ day: '2026-11-07' });

  expect(confirmCapturedPayment).toHaveBeenCalledWith(
    expect.objectContaining({ _id: 'p1' }),
    expect.objectContaining({ id: 'pay_1' }),
    { source: 'reconciliation' },
  );
  expect(markRefundProcessed).toHaveBeenCalledWith('rfnd_1');
  expect(Payment.updateOne).toHaveBeenCalledWith(
    { _id: 'p1' },
    { $set: { razorpayFeePaise: 2_360, razorpayTaxPaise: 360 } },
  );
  expect(report.status).toBe('mismatch');
  expect(report.mismatches.map((m) => m.kind)).toEqual([
    'missed_capture',
    'amount_mismatch',
    'missed_refund_processed',
  ]);
  expect(report.mismatches.filter((m) => !m.autoFixed)).toHaveLength(1);
});

it('stores a failed report when Razorpay cannot be reached', async () => {
  razorpay.listEntities.mockRejectedValue(new Error('Payment provider error: timeout'));
  const report = await runReconciliation({ day: '2026-11-07' });
  expect(report).toMatchObject({ status: 'failed', error: 'Payment provider error: timeout' });
});
