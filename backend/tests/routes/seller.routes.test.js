/**
 * Day 5 route permissions: dealer dashboard (team member vs owner), admin sellers role
 * matrix (Support / Finance get 403), audit log (Admin only), and the audit entry written
 * when a KYC is approved ("Done when").
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
jest.mock('../../src/services/seller/sellerAccount.service', () => ({
  getMyDealer: jest.fn(async () => ({ id: 'seller1' })),
  updateDealerProfile: jest.fn(async () => ({ id: 'seller1' })),
}));
jest.mock('../../src/services/seller/sellerAdmin.service', () => ({
  listSellers: jest.fn(async () => ({ sellers: [], meta: {} })),
  approveKyc: jest.fn(async () => ({
    seller: { id: 'seller1', kyc: { status: 'approved' } },
    before: { kycStatus: 'pending' },
  })),
}));

const request = require('supertest');
const { Types } = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const SellerStaff = require('../../src/models/sellerStaff.model');
const Seller = require('../../src/models/seller.model');
const AuditLog = require('../../src/models/auditLog.model');
const sellerAccount = require('../../src/services/seller/sellerAccount.service');
const { signAccessToken } = require('../../src/services/auth/token.service');
const { TOKEN_AUDIENCE, STAFF_ROLE } = require('../../src/constants/enums');

const userId = new Types.ObjectId().toString();
const sellerId = new Types.ObjectId().toString();
const sessionId = new Types.ObjectId().toString();

const appToken = () =>
  signAccessToken({
    userId,
    sessionId,
    audience: TOKEN_AUDIENCE.APP,
    claims: { roles: ['buyer', 'seller'] },
  }).token;
const staffToken = (staffRole) =>
  signAccessToken({ userId, sessionId, audience: TOKEN_AUDIENCE.STAFF, claims: { staffRole } })
    .token;

const lean = (value) => ({ lean: async () => value, select: () => ({ lean: async () => value }) });
const membershipIs = (role) =>
  SellerStaff.findOne.mockReturnValue(lean(role ? { sellerId, role } : null));
const staffIs = (staffRole) =>
  User.findById.mockReturnValue({ select: () => Promise.resolve({ staffRole, status: 'active' }) });

describe('/api/seller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Seller.findById.mockReturnValue(lean({ status: 'active' }));
  });

  it('needs a login', async () => {
    expect((await request(app).get('/api/seller/me')).status).toBe(401);
  });

  it('gives 403 to a buyer who is not in a dealer team', async () => {
    membershipIs(null);
    const res = await request(app)
      .get('/api/seller/me')
      .set('Authorization', `Bearer ${appToken()}`);
    expect(res.status).toBe(403);
  });

  it('lets team staff read the dashboard but not change the profile', async () => {
    membershipIs('staff');
    const me = await request(app)
      .get('/api/seller/me')
      .set('Authorization', `Bearer ${appToken()}`);
    expect(me.status).toBe(200);
    expect(sellerAccount.getMyDealer).toHaveBeenCalledWith({ sellerId, role: 'staff' });

    const edit = await request(app)
      .patch('/api/seller/profile')
      .set('Authorization', `Bearer ${appToken()}`)
      .send({ contactName: 'Ravi Patil' });
    expect(edit.status).toBe(403);
  });

  it('lets the owner change the profile', async () => {
    membershipIs('owner');
    const res = await request(app)
      .patch('/api/seller/profile')
      .set('Authorization', `Bearer ${appToken()}`)
      .send({ contactName: 'Ravi Patil' });
    expect(res.status).toBe(200);
  });

  it('blocks suspended dealers', async () => {
    membershipIs('owner');
    Seller.findById.mockReturnValue(lean({ status: 'suspended' }));
    const res = await request(app)
      .get('/api/seller/me')
      .set('Authorization', `Bearer ${appToken()}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SELLER_SUSPENDED');
  });

  it('refuses a staff token on dealer routes', async () => {
    const res = await request(app)
      .get('/api/seller/me')
      .set('Authorization', `Bearer ${staffToken(STAFF_ROLE.OWNER)}`);
    expect(res.status).toBe(401);
  });

  it('needs the X-Requested-With header to refresh by cookie (CSRF)', async () => {
    const res = await request(app).post('/api/seller/auth/refresh');
    expect(res.status).toBe(403);
  });
});

describe('/api/admin/sellers and /api/admin/audit-logs', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    [STAFF_ROLE.SUPPORT, 403],
    [STAFF_ROLE.FINANCE, 403],
    [STAFF_ROLE.DEAL_MANAGER, 200],
    [STAFF_ROLE.ADMIN, 200],
    [STAFF_ROLE.OWNER, 200],
  ])('%s → %i on the seller list', async (role, status) => {
    staffIs(role);
    const res = await request(app)
      .get('/api/admin/sellers')
      .set('Authorization', `Bearer ${staffToken(role)}`);
    expect(res.status).toBe(status);
  });

  it('keeps the audit log from Deal Managers', async () => {
    staffIs(STAFF_ROLE.DEAL_MANAGER);
    const res = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${staffToken(STAFF_ROLE.DEAL_MANAGER)}`);
    expect(res.status).toBe(403);
  });

  it('writes an audit entry when KYC is approved', async () => {
    staffIs(STAFF_ROLE.ADMIN);
    const res = await request(app)
      .post(`/api/admin/sellers/${sellerId}/kyc/approve`)
      .set('Authorization', `Bearer ${staffToken(STAFF_ROLE.ADMIN)}`)
      .send({ note: 'Documents match' });
    expect(res.status).toBe(200);
    await new Promise((resolve) => setImmediate(resolve));
    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: userId,
        actorRole: STAFF_ROLE.ADMIN,
        action: 'seller.kyc.approve',
        targetType: 'seller',
        targetId: sellerId,
        before: { kycStatus: 'pending' },
        after: { kycStatus: 'approved' },
        reason: 'Documents match',
      }),
    );
  });
});
