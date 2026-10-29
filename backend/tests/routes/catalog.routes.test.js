/**
 * Route tests for public product routes and admin catalog permissions/validation.
 */
jest.mock('../../src/config/db', () => ({
  ...jest.requireActual('../../src/config/db'),
  getDBStatus: () => 'connected',
}));
jest.mock('../../src/services/catalog/productQuery.service', () => ({
  listProducts: jest.fn(async () => ({
    products: [],
    meta: { page: 1, hasNextPage: false, cityId: null },
  })),
  getProduct: jest.fn(async () => ({ id: 'p1', categoryId: 'c1', cityId: 'city1' })),
  getProductPriceHistory: jest.fn(async () => ({ cityId: null, points: [] })),
}));
jest.mock('../../src/services/catalog/productImport.service', () => ({
  importProductsCsv: jest.fn(async () => ({ dryRun: true, failedRows: [] })),
  getImportTemplateCsv: () => 'category,brand,model\r\n',
}));
jest.mock('../../src/services/demandSignal.service', () => ({ recordSignal: jest.fn() }));
jest.mock('../../src/services/auth/session.service', () => ({
  ...jest.requireActual('../../src/services/auth/session.service'),
  assertStaffSessionActive: jest.fn(async () => ({})),
}));
jest.mock('../../src/models/user.model', () => ({ findById: jest.fn() }));

const request = require('supertest');
const { Types } = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const { importProductsCsv } = require('../../src/services/catalog/productImport.service');
const { recordSignal } = require('../../src/services/demandSignal.service');
const { signAccessToken } = require('../../src/services/auth/token.service');
const { TOKEN_AUDIENCE } = require('../../src/constants/enums');

const userId = new Types.ObjectId().toString();
const sessionId = new Types.ObjectId().toString();
const buyerToken = signAccessToken({
  userId,
  sessionId,
  audience: TOKEN_AUDIENCE.APP,
  claims: { roles: ['buyer'] },
}).token;
const staffToken = signAccessToken({ userId, sessionId, audience: TOKEN_AUDIENCE.STAFF }).token;
const staffRoleIs = (staffRole) =>
  User.findById.mockReturnValue({ select: () => Promise.resolve({ staffRole, status: 'active' }) });

describe('public product routes', () => {
  it('lists products without login and validates ids', async () => {
    expect((await request(app).get('/api/products?q=activa')).status).toBe(200);
    expect((await request(app).get('/api/products?categoryId=nope')).status).toBe(422);
    expect((await request(app).get('/api/products/not-an-id')).status).toBe(422);
  });

  it('records search and view signals only for logged-in users', async () => {
    await request(app).get('/api/products?q=activa');
    expect(recordSignal).not.toHaveBeenCalled();

    const auth = { Authorization: `Bearer ${buyerToken}` };
    await request(app).get('/api/products?q=activa').set(auth);
    await request(app).get(`/api/products/${new Types.ObjectId()}`).set(auth);
    expect(recordSignal.mock.calls.map(([signal]) => signal.type)).toEqual(['search', 'view']);
  });

  it('requires login to register interest', async () => {
    expect((await request(app).post(`/api/products/${new Types.ObjectId()}/interest`)).status).toBe(
      401,
    );
  });
});

describe('admin catalog routes', () => {
  const auth = { Authorization: `Bearer ${staffToken}` };

  it('allows Owner, Admin and Deal Manager; blocks Support, Finance and buyers', async () => {
    for (const role of ['owner', 'admin', 'deal_manager']) {
      staffRoleIs(role);
      expect((await request(app).get('/api/admin/products/import/template').set(auth)).status).toBe(
        200,
      );
    }
    for (const role of ['support', 'finance']) {
      staffRoleIs(role);
      expect((await request(app).get('/api/admin/categories').set(auth)).status).toBe(403);
    }
    const buyer = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(buyer.status).toBe(403);
  });

  it('does not let the catalog role check leak onto other admin paths', async () => {
    staffRoleIs('finance');
    // Unknown admin path: staff passes requireStaff(), then 404 (not the catalog 403)
    expect((await request(app).get('/api/admin/does-not-exist').set(auth)).status).toBe(404);
  });

  it('imports CSV sent as text/csv, with dryRun', async () => {
    staffRoleIs('deal_manager');
    const res = await request(app)
      .post('/api/admin/products/import?dryRun=true')
      .set(auth)
      .set('Content-Type', 'text/csv')
      .send('category,brand,model\ntwo-wheelers,Honda,Activa');
    expect(res.status).toBe(200);
    expect(importProductsCsv).toHaveBeenCalledWith(expect.stringContaining('Honda,Activa'), {
      dryRun: true,
      staffUserId: userId,
    });

    const empty = await request(app)
      .post('/api/admin/products/import')
      .set(auth)
      .set('Content-Type', 'text/csv')
      .send('');
    expect(empty.status).toBe(400);
  });

  it('validates category rules (integer paise, min ≤ max, percent ≤ 100%)', async () => {
    staffRoleIs('admin');
    const url = `/api/admin/categories/${new Types.ObjectId()}`;
    const bad = [
      { rules: { tokenAmountPaise: 999.5 } },
      { rules: { minSize: 30, maxSize: 10 } },
      { rules: { commission: { type: 'percent', value: 20000 } } },
      { rules: { auction: { durationHours: 0 } } },
    ];
    for (const body of bad) {
      expect((await request(app).patch(url).set(auth).send(body)).status).toBe(422);
    }
  });

  it('validates product prices (at least one price per row)', async () => {
    staffRoleIs('admin');
    const res = await request(app)
      .post('/api/admin/products')
      .set(auth)
      .send({
        categoryId: new Types.ObjectId().toString(),
        brand: 'Honda',
        model: 'Activa',
        prices: [{ cityId: new Types.ObjectId().toString() }],
      });
    expect(res.status).toBe(422);
  });
});
