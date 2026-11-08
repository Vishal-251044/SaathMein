/**
 * Payment routes: buyers must be logged in; the order body may not carry an amount; the
 * webhook receives the RAW body (exact bytes) and needs no login; a bad signature gets 400.
 */
jest.mock('../../src/config/db', () => ({
  ...jest.requireActual('../../src/config/db'),
  getDBStatus: () => 'connected',
}));
jest.mock('../../src/services/payments/payment.service', () => ({
  createTokenOrder: jest.fn(async () => ({ orderId: 'order_1', amountPaise: 100_000 })),
  verifyCheckout: jest.fn(),
  cancelCheckout: jest.fn(),
}));
jest.mock('../../src/services/payments/webhook.service', () => ({
  processWebhook: jest.fn(async () => ({ status: 'processed' })),
}));

const request = require('supertest');
const { Types } = require('mongoose');
const app = require('../../src/app');
const { createTokenOrder } = require('../../src/services/payments/payment.service');
const { processWebhook } = require('../../src/services/payments/webhook.service');
const { signAccessToken } = require('../../src/services/auth/token.service');
const { TOKEN_AUDIENCE } = require('../../src/constants/enums');

const userId = new Types.ObjectId().toString();
const token = signAccessToken({
  userId,
  sessionId: new Types.ObjectId().toString(),
  audience: TOKEN_AUDIENCE.APP,
  claims: { roles: ['buyer'] },
}).token;
const groupId = new Types.ObjectId().toString();

beforeEach(() => jest.clearAllMocks());

it('needs a login to start a checkout', async () => {
  expect((await request(app).post('/api/payments/order').send({ groupId })).status).toBe(401);
});

it('never accepts an amount from the app', async () => {
  const res = await request(app)
    .post('/api/payments/order')
    .set('Authorization', `Bearer ${token}`)
    .send({ groupId, amountPaise: 100 });
  expect(res.status).toBe(422);
  expect(createTokenOrder).not.toHaveBeenCalled();
});

it('creates a checkout for a logged-in buyer', async () => {
  const res = await request(app)
    .post('/api/payments/order')
    .set('Authorization', `Bearer ${token}`)
    .send({ groupId });
  expect(res.status).toBe(201);
  expect(createTokenOrder).toHaveBeenCalledWith(userId, { groupId });
});

it('passes the exact raw webhook bytes and headers to the webhook service', async () => {
  const raw = '{"event":"payment.captured",  "payload":{}}';
  const res = await request(app)
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('x-razorpay-signature', 'sig')
    .set('x-razorpay-event-id', 'evt_1')
    .send(raw);
  expect(res.status).toBe(200);
  const { rawBody, signature, eventId } = processWebhook.mock.calls[0][0];
  expect(Buffer.isBuffer(rawBody)).toBe(true);
  expect(rawBody.toString()).toBe(raw);
  expect({ signature, eventId }).toEqual({ signature: 'sig', eventId: 'evt_1' });
});

it('answers 400 to a bad signature (Razorpay will not retry it)', async () => {
  const ApiError = require('../../src/utils/ApiError');
  processWebhook.mockRejectedValueOnce(
    ApiError.badRequest('Invalid webhook signature', { code: 'INVALID_SIGNATURE' }),
  );
  const res = await request(app)
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .send('{}');
  expect(res.status).toBe(400);
});
