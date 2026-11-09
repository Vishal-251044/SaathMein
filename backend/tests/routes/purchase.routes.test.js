/**
 * Day 10 route permissions: admin Commissions (Owner / Admin / Finance only — Support and
 * Deal Manager get 403), dealer purchase confirm (team members, validated input), buyer
 * review (login + 1–5 stars) and invoice upload (login).
 */
jest.mock('../../src/config/db', () => ({
  ...jest.requireActual('../../src/config/db'),
  getDBStatus: () => 'connected',
}));
jest.mock('../../src/services/auth/session.service', () => ({
  ...jest.requireActual('../../src/services/auth/session.service'),
  assertStaffSessionActive: jest.fn(async () => ({})),
}));
jest.mock('../../src/models/user.model', () => ({ findById: jest.fn() }));
jest.mock('../../src/models/sellerStaff.model', () => ({ findOne: jest.fn() }));
jest.mock('../../src/models/seller.model', () => {
  const { KYC_DOC_TYPES, BUSINESS_TYPES } = jest.requireActual('../../src/models/seller.model');
  return { findById: jest.fn(), KYC_DOC_TYPES, BUSINESS_TYPES };
});
jest.mock('../../src/models/auditLog.model', () => ({ create: jest.fn(async () => ({})) }));
jest.mock('../../src/services/payments/commission.service', () => ({
  listCommissions: jest.fn(async () => ({ commissions: [], totals: {}, meta: {} })),
  commissionCsvRows: jest.fn(async () => [['Date'], ['2026-11-01']]),
  listInvoices: jest.fn(async () => ({ invoices: [], meta: {} })),
  getInvoice: jest.fn(async () => ({ id: 'i1' })),
  generateMonthlyInvoices: jest.fn(async () => ({ period: '2026-10', issued: 2, failed: 0 })),
}));
jest.mock('../../src/services/purchases/purchase.service', () => ({
  confirmPurchase: jest.fn(async () => ({ id: 'p1', status: 'completed' })),
  lookupPurchase: jest.fn(async () => ({ id: 'p1' })),
  getInvoiceUploadParams: jest.fn(async () => ({ uploadUrl: 'u', fields: {} })),
  listMyDealCodes: jest.fn(async () => []),
}));
jest.mock('../../src/services/purchases/review.service', () => ({
  createReview: jest.fn(async () => ({ id: 'r1', rating: 5 })),
}));

const request = require('supertest');
const { Types } = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const SellerStaff = require('../../src/models/sellerStaff.model');
const Seller = require('../../src/models/seller.model');
const commissionService = require('../../src/services/payments/commission.service');
const purchaseService = require('../../src/services/purchases/purchase.service');
const reviewService = require('../../src/services/purchases/review.service');
const { signAccessToken } = require('../../src/services/auth/token.service');
const { TOKEN_AUDIENCE, STAFF_ROLE } = require('../../src/constants/enums');

const userId = new Types.ObjectId().toString();
const sellerId = new Types.ObjectId().toString();
const sessionId = new Types.ObjectId().toString();
const purchaseId = new Types.ObjectId().toString();

const appToken = () =>
  signAccessToken({ userId, sessionId, audience: TOKEN_AUDIENCE.APP, claims: { roles: ['buyer'] } })
    .token;
const staffToken = (staffRole) =>
  signAccessToken({ userId, sessionId, audience: TOKEN_AUDIENCE.STAFF, claims: { staffRole } })
    .token;
const lean = (value) => ({ lean: async () => value, select: () => ({ lean: async () => value }) });
const staffIs = (staffRole) =>
  User.findById.mockReturnValue({ select: () => Promise.resolve({ staffRole, status: 'active' }) });

beforeEach(() => jest.clearAllMocks());

describe('/api/admin/commissions (Finance module)', () => {
  it.each([
    [STAFF_ROLE.SUPPORT, 403],
    [STAFF_ROLE.DEAL_MANAGER, 403],
    [STAFF_ROLE.FINANCE, 200],
    [STAFF_ROLE.ADMIN, 200],
    [STAFF_ROLE.OWNER, 200],
  ])('%s → %i', async (role, status) => {
    staffIs(role);
    const res = await request(app)
      .get('/api/admin/commissions')
      .set('Authorization', `Bearer ${staffToken(role)}`);
    expect(res.status).toBe(status);
  });

  it('exports CSV', async () => {
    staffIs(STAFF_ROLE.FINANCE);
    const res = await request(app)
      .get('/api/admin/commissions?format=csv')
      .set('Authorization', `Bearer ${staffToken(STAFF_ROLE.FINANCE)}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
  });

  it('issues a month on request, with a valid month only', async () => {
    staffIs(STAFF_ROLE.FINANCE);
    const auth = { Authorization: `Bearer ${staffToken(STAFF_ROLE.FINANCE)}` };
    const ok = await request(app)
      .post('/api/admin/commission-invoices/generate')
      .set(auth)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ month: '2026-10' });
    expect(ok.status).toBe(200);
    expect(commissionService.generateMonthlyInvoices).toHaveBeenCalledWith('2026-10');

    const bad = await request(app)
      .post('/api/admin/commission-invoices/generate')
      .set(auth)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ month: 'october' });
    expect(bad.status).toBe(422);
  });

  it('buyers get 403', async () => {
    const res = await request(app)
      .get('/api/admin/commissions')
      .set('Authorization', `Bearer ${appToken()}`);
    expect([401, 403]).toContain(res.status);
  });
});

describe('/api/seller/purchases', () => {
  beforeEach(() => {
    Seller.findById.mockReturnValue(lean({ status: 'active' }));
    SellerStaff.findOne.mockReturnValue(lean({ sellerId, role: 'staff' }));
  });

  it('team staff can confirm a scanned code', async () => {
    const res = await request(app)
      .post('/api/seller/purchases/confirm')
      .set('Authorization', `Bearer ${appToken()}`)
      .send({ code: 'SM1.ABCDEFGH23.signature1234567' });
    expect(res.status).toBe(200);
    expect(purchaseService.confirmPurchase).toHaveBeenCalledWith(
      { sellerId, userId },
      'SM1.ABCDEFGH23.signature1234567',
    );
  });

  it('needs a code', async () => {
    const res = await request(app)
      .post('/api/seller/purchases/confirm')
      .set('Authorization', `Bearer ${appToken()}`)
      .send({});
    expect(res.status).toBe(422);
    expect(purchaseService.confirmPurchase).not.toHaveBeenCalled();
  });

  it('buyers outside a dealer team get 403', async () => {
    SellerStaff.findOne.mockReturnValue(lean(null));
    const res = await request(app)
      .post('/api/seller/purchases/lookup')
      .set('Authorization', `Bearer ${appToken()}`)
      .send({ code: 'ABCDEFGH23' });
    expect(res.status).toBe(403);
  });
});

describe('buyer purchases and reviews', () => {
  it('reviews need a login and 1–5 stars', async () => {
    expect((await request(app).post('/api/reviews').send({ purchaseId, rating: 5 })).status).toBe(
      401,
    );
    const bad = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${appToken()}`)
      .send({ purchaseId, rating: 6 });
    expect(bad.status).toBe(422);
    const ok = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${appToken()}`)
      .send({ purchaseId, rating: 5, text: 'Honoured the price, quick delivery' });
    expect(ok.status).toBe(201);
    expect(reviewService.createReview).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ rating: 5 }),
    );
  });

  it('invoice upload params need a login', async () => {
    const res = await request(app).post(`/api/purchases/${purchaseId}/invoice/upload-params`);
    expect(res.status).toBe(401);
  });

  it('my deal codes', async () => {
    const res = await request(app)
      .get('/api/users/me/deal-codes')
      .set('Authorization', `Bearer ${appToken()}`);
    expect(res.status).toBe(200);
  });
});
