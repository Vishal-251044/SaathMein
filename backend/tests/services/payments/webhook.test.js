/**
 * Razorpay webhooks (PAY-2): bad signatures are refused, an event id is processed once
 * (duplicates skipped), a failed event runs again on redelivery, events go to the right
 * handler, unknown events are ignored.
 */
jest.mock('../../../src/models/webhookEvent.model', () => ({
  create: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../../../src/models/payment.model', () => ({ findOne: jest.fn() }));
jest.mock('../../../src/models/settlement.model', () => ({ updateOne: jest.fn() }));
jest.mock('../../../src/models/seller.model', () => ({ findOne: jest.fn() }));
jest.mock('../../../src/services/payments/payment.service', () => ({
  confirmCapturedPayment: jest.fn(),
  handlePaymentFailed: jest.fn(async () => true),
}));
jest.mock('../../../src/services/payments/refund.service', () => ({
  markRefundProcessed: jest.fn(async () => true),
  markRefundFailed: jest.fn(async () => true),
}));
jest.mock('../../../src/services/payments/route.service', () => ({
  handleTransferEvent: jest.fn(async () => true),
}));

const crypto = require('crypto');
const WebhookEvent = require('../../../src/models/webhookEvent.model');
const Payment = require('../../../src/models/payment.model');
const Settlement = require('../../../src/models/settlement.model');
const { confirmCapturedPayment } = require('../../../src/services/payments/payment.service');
const { markRefundProcessed } = require('../../../src/services/payments/refund.service');
const { handleTransferEvent } = require('../../../src/services/payments/route.service');
const { processWebhook } = require('../../../src/services/payments/webhook.service');

/** Signed delivery as Razorpay sends it. */
const delivery = (body, eventId = 'evt_1') => {
  const rawBody = Buffer.from(JSON.stringify(body));
  const signature = crypto
    .createHmac('sha256', 'test-razorpay-webhook-secret')
    .update(rawBody)
    .digest('hex');
  return { rawBody, signature, eventId };
};

const captured = {
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: 'pay_1',
        order_id: 'order_1',
        amount: 100_000,
        currency: 'INR',
        status: 'captured',
      },
    },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  WebhookEvent.create.mockResolvedValue({});
  WebhookEvent.updateOne.mockResolvedValue({ modifiedCount: 0 });
});

it('refuses a wrong signature and processes nothing', async () => {
  await expect(
    processWebhook({ ...delivery(captured), signature: 'f'.repeat(64) }),
  ).rejects.toMatchObject({
    statusCode: 400,
    code: 'INVALID_SIGNATURE',
  });
  expect(WebhookEvent.create).not.toHaveBeenCalled();
});

it('processes payment.captured through the join path', async () => {
  Payment.findOne.mockReturnValue({
    lean: async () => ({ _id: 'p1', razorpayOrderId: 'order_1' }),
  });
  expect(await processWebhook(delivery(captured))).toEqual({ status: 'processed' });
  expect(confirmCapturedPayment).toHaveBeenCalledWith(
    { _id: 'p1', razorpayOrderId: 'order_1' },
    captured.payload.payment.entity,
    { source: 'webhook' },
  );
  expect(WebhookEvent.updateOne).toHaveBeenLastCalledWith(
    { eventId: 'evt_1' },
    { $set: expect.objectContaining({ status: 'processed', entityId: 'pay_1' }) },
  );
});

it('skips a duplicate delivery of the same event id', async () => {
  WebhookEvent.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
  WebhookEvent.updateOne.mockResolvedValueOnce({ modifiedCount: 0 }); // not a failed one
  expect(await processWebhook(delivery(captured))).toEqual({ status: 'duplicate' });
  expect(confirmCapturedPayment).not.toHaveBeenCalled();
});

it('runs a previously failed event again on redelivery', async () => {
  WebhookEvent.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
  WebhookEvent.updateOne.mockResolvedValueOnce({ modifiedCount: 1 }); // failed → processing
  Payment.findOne.mockReturnValue({ lean: async () => ({ _id: 'p1' }) });
  expect(await processWebhook(delivery(captured))).toEqual({ status: 'processed' });
  expect(confirmCapturedPayment).toHaveBeenCalled();
});

it('marks the event failed and rethrows so Razorpay retries', async () => {
  Payment.findOne.mockReturnValue({ lean: async () => ({ _id: 'p1' }) });
  confirmCapturedPayment.mockRejectedValueOnce(new Error('db down'));
  await expect(processWebhook(delivery(captured))).rejects.toThrow('db down');
  expect(WebhookEvent.updateOne).toHaveBeenLastCalledWith(
    { eventId: 'evt_1' },
    { $set: { status: 'failed', error: 'db down' } },
  );
});

it('ignores payments that are not SaathMein token orders', async () => {
  Payment.findOne.mockReturnValue({ lean: async () => null });
  expect(await processWebhook(delivery(captured))).toEqual({ status: 'ignored' });
});

it('routes refund, transfer and settlement events', async () => {
  await processWebhook(
    delivery(
      {
        event: 'refund.processed',
        payload: { refund: { entity: { id: 'rfnd_1', created_at: 1_700_000_000 } } },
      },
      'evt_r',
    ),
  );
  expect(markRefundProcessed).toHaveBeenCalledWith('rfnd_1', new Date(1_700_000_000_000));

  await processWebhook(
    delivery(
      { event: 'transfer.failed', payload: { transfer: { entity: { id: 'trf_1' } } } },
      'evt_t',
    ),
  );
  expect(handleTransferEvent).toHaveBeenCalledWith({ id: 'trf_1' }, true);

  await processWebhook(
    delivery(
      {
        event: 'settlement.processed',
        account_id: undefined,
        payload: {
          settlement: { entity: { id: 'setl_1', amount: 500_000, fees: 0, tax: 0, utr: 'UTR1' } },
        },
      },
      'evt_s',
    ),
  );
  expect(Settlement.updateOne).toHaveBeenCalledWith(
    { razorpaySettlementId: 'setl_1' },
    expect.objectContaining({
      $setOnInsert: expect.objectContaining({ amountPaise: 500_000, utr: 'UTR1' }),
    }),
    { upsert: true },
  );
});

it('stores unknown events as ignored', async () => {
  expect(await processWebhook(delivery({ event: 'order.paid', payload: {} }, 'evt_o'))).toEqual({
    status: 'ignored',
  });
});
