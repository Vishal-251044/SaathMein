/**
 * Permission tests for requireAuth, requireRole and requireStaff (PRD §8.2).
 * Includes the Day 2 "Done when" check: buyers get 403 on admin APIs.
 */
// Pretend MongoDB is connected so requests reach the auth routes
jest.mock('../../src/config/db', () => ({
  ...jest.requireActual('../../src/config/db'),
  getDBStatus: () => 'connected',
}));

jest.mock('../../src/services/auth/session.service', () => ({
  ...jest.requireActual('../../src/services/auth/session.service'),
  assertStaffSessionActive: jest.fn(),
}));
jest.mock('../../src/models/user.model', () => ({ findById: jest.fn() }));

const express = require('express');
const request = require('supertest');
const { Types } = require('mongoose');
const User = require('../../src/models/user.model');
const { assertStaffSessionActive } = require('../../src/services/auth/session.service');
const { signAccessToken } = require('../../src/services/auth/token.service');
const { requireAuth, requireRole } = require('../../src/middlewares/auth.middleware');
const { requireStaff } = require('../../src/middlewares/staffAuth.middleware');
const { errorHandler } = require('../../src/middlewares/error.middleware');
const app = require('../../src/app');
const { TOKEN_AUDIENCE, STAFF_ROLE } = require('../../src/constants/enums');

const userId = new Types.ObjectId().toString();
const sessionId = new Types.ObjectId().toString();

const appToken = (roles = ['buyer']) =>
  signAccessToken({ userId, sessionId, audience: TOKEN_AUDIENCE.APP, claims: { roles } }).token;
const staffToken = (staffRole) =>
  signAccessToken({ userId, sessionId, audience: TOKEN_AUDIENCE.STAFF, claims: { staffRole } })
    .token;

/** Mimic `User.findById(...).select(...)`. */
const staffUserIs = (doc) => User.findById.mockReturnValue({ select: () => Promise.resolve(doc) });

/** Tiny app with protected test routes. */
const buildTestApp = () => {
  const testApp = express();
  testApp.get('/buyer', requireAuth, (req, res) => res.json({ userId: req.auth.userId }));
  testApp.get('/seller-only', requireAuth, requireRole('seller'), (req, res) => res.json({}));
  testApp.get('/any-staff', requireStaff(), (req, res) => res.json({ role: req.staff.role }));
  testApp.get('/finance', requireStaff(STAFF_ROLE.FINANCE), (req, res) => res.json({}));
  testApp.use(errorHandler);
  return testApp;
};

describe('requireAuth / requireRole', () => {
  const testApp = buildTestApp();

  it('returns 401 without a token or with a bad token', async () => {
    expect((await request(testApp).get('/buyer')).status).toBe(401);
    const res = await request(testApp).get('/buyer').set('Authorization', 'Bearer nope');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('lets a buyer through and blocks seller-only routes with 403', async () => {
    const ok = await request(testApp).get('/buyer').set('Authorization', `Bearer ${appToken()}`);
    expect(ok.status).toBe(200);
    expect(ok.body.userId).toBe(userId);

    const denied = await request(testApp)
      .get('/seller-only')
      .set('Authorization', `Bearer ${appToken()}`);
    expect(denied.status).toBe(403);

    const seller = await request(testApp)
      .get('/seller-only')
      .set('Authorization', `Bearer ${appToken(['buyer', 'seller'])}`);
    expect(seller.status).toBe(200);
  });

  it('does not accept a staff token on app routes', async () => {
    const res = await request(testApp)
      .get('/buyer')
      .set('Authorization', `Bearer ${staffToken(STAFF_ROLE.OWNER)}`);
    expect(res.status).toBe(401);
  });
});

describe('requireStaff', () => {
  const testApp = buildTestApp();

  beforeEach(() => {
    assertStaffSessionActive.mockResolvedValue({});
  });

  it('gives buyers 403 on staff routes (Day 2 "Done when")', async () => {
    const res = await request(testApp)
      .get('/any-staff')
      .set('Authorization', `Bearer ${appToken()}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Staff access only');
  });

  it('gives buyers 403 on the real admin API', async () => {
    const res = await request(app)
      .get('/api/admin/auth/me')
      .set('Authorization', `Bearer ${appToken()}`);
    expect(res.status).toBe(403);
  });

  it('returns 401 without a token', async () => {
    expect((await request(testApp).get('/any-staff')).status).toBe(401);
  });

  it('allows the Owner everywhere and enforces roles for other staff', async () => {
    staffUserIs({ staffRole: STAFF_ROLE.OWNER, status: 'active' });
    const owner = await request(testApp)
      .get('/finance')
      .set('Authorization', `Bearer ${staffToken(STAFF_ROLE.OWNER)}`);
    expect(owner.status).toBe(200);

    staffUserIs({ staffRole: STAFF_ROLE.FINANCE, status: 'active' });
    const finance = await request(testApp)
      .get('/finance')
      .set('Authorization', `Bearer ${staffToken(STAFF_ROLE.FINANCE)}`);
    expect(finance.status).toBe(200);

    staffUserIs({ staffRole: STAFF_ROLE.SUPPORT, status: 'active' });
    const support = await request(testApp)
      .get('/finance')
      .set('Authorization', `Bearer ${staffToken(STAFF_ROLE.SUPPORT)}`);
    expect(support.status).toBe(403);
  });

  it('uses the role from the database, not the token', async () => {
    // Token says owner, but the account was changed to support
    staffUserIs({ staffRole: STAFF_ROLE.SUPPORT, status: 'active' });
    const res = await request(testApp)
      .get('/finance')
      .set('Authorization', `Bearer ${staffToken(STAFF_ROLE.OWNER)}`);
    expect(res.status).toBe(403);
  });

  it('blocks suspended staff and ended sessions', async () => {
    staffUserIs({ staffRole: STAFF_ROLE.ADMIN, status: 'suspended' });
    const suspended = await request(testApp)
      .get('/any-staff')
      .set('Authorization', `Bearer ${staffToken(STAFF_ROLE.ADMIN)}`);
    expect(suspended.status).toBe(403);

    const ApiError = require('../../src/utils/ApiError');
    assertStaffSessionActive.mockRejectedValue(
      new ApiError(401, 'ended', { code: 'SESSION_IDLE' }),
    );
    const idle = await request(testApp)
      .get('/any-staff')
      .set('Authorization', `Bearer ${staffToken(STAFF_ROLE.ADMIN)}`);
    expect(idle.status).toBe(401);
    expect(idle.body.error.code).toBe('SESSION_IDLE');
  });
});
