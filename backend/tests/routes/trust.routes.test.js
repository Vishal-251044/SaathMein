/**
 * Day 12 route permissions: Disputes and Reports queue for Owner / Admin / Support only
 * (Finance and Deal Manager get 403); deciding needs a reason; buyers need a login to
 * report or open disputes; the public dealer profile is open.
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
jest.mock('../../src/models/auditLog.model', () => ({ create: jest.fn(async () => ({})) }));
jest.mock('../../src/services/trust/dispute.service', () => ({
  adminListDisputes: jest.fn(async () => ({ disputes: [], meta: {} })),
  decideDispute: jest.fn(async () => ({ before: {}, after: { id: 'd1' } })),
}));
jest.mock('../../src/services/trust/report.service', () => ({
  adminListReports: jest.fn(async () => ({ reports: [], meta: {} })),
  createReport: jest.fn(async () => ({ id: 'r1', status: 'open' })),
}));
jest.mock('../../src/services/seller/sellerPublic.service', () => ({
  getPublicSeller: jest.fn(async () => ({ id: 's1', businessName: 'Pune Motors' })),
  listSellerReviews: jest.fn(async () => ({ reviews: [], meta: {} })),
  listVerifiedSellers: jest.fn(async () => []),
}));

const request = require('supertest');
const { Types } = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const AuditLog = require('../../src/models/auditLog.model');
const disputeService = require('../../src/services/trust/dispute.service');
const { signAccessToken } = require('../../src/services/auth/token.service');
const { TOKEN_AUDIENCE, STAFF_ROLE } = require('../../src/constants/enums');

const userId = new Types.ObjectId().toString();
const sessionId = new Types.ObjectId().toString();
const disputeId = new Types.ObjectId().toString();
const staffHeaders = (staffRole) => ({
  Authorization: `Bearer ${signAccessToken({ userId, sessionId, audience: TOKEN_AUDIENCE.STAFF, claims: { staffRole } }).token}`,
  'X-Requested-With': 'XMLHttpRequest',
});
const staffIs = (staffRole) =>
  User.findById.mockReturnValue({ select: () => Promise.resolve({ staffRole, status: 'active' }) });

beforeEach(() => jest.clearAllMocks());

describe('Disputes and Reports queue', () => {
  it.each([
    [STAFF_ROLE.FINANCE, 403],
    [STAFF_ROLE.DEAL_MANAGER, 403],
    [STAFF_ROLE.SUPPORT, 200],
    [STAFF_ROLE.ADMIN, 200],
    [STAFF_ROLE.OWNER, 200],
  ])('%s → %i', async (role, status) => {
    staffIs(role);
    expect((await request(app).get('/api/admin/disputes').set(staffHeaders(role))).status).toBe(
      status,
    );
    expect((await request(app).get('/api/admin/reports').set(staffHeaders(role))).status).toBe(
      status,
    );
  });

  it('a decision needs a reason and is audited', async () => {
    staffIs(STAFF_ROLE.SUPPORT);
    const missing = await request(app)
      .post(`/api/admin/disputes/${disputeId}/decide`)
      .set(staffHeaders(STAFF_ROLE.SUPPORT))
      .send({ outcome: 'refund' });
    expect(missing.status).toBe(422);
    expect(disputeService.decideDispute).not.toHaveBeenCalled();

    const ok = await request(app)
      .post(`/api/admin/disputes/${disputeId}/decide`)
      .set(staffHeaders(STAFF_ROLE.SUPPORT))
      .send({
        outcome: 'refund',
        penalties: ['rating_penalty'],
        note: 'Dealer charged ₹4,000 above the price.',
      });
    expect(ok.status).toBe(200);
    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'dispute.decide',
        reason: 'Dealer charged ₹4,000 above the price.',
      }),
    );
  });
});

describe('buyers', () => {
  it('need a login to report or open a dispute', async () => {
    expect((await request(app).post('/api/reports').send({})).status).toBe(401);
    expect((await request(app).post('/api/disputes').send({})).status).toBe(401);
  });

  it('can see a dealer profile without logging in', async () => {
    const res = await request(app).get(`/api/sellers/${new Types.ObjectId()}`);
    expect(res.status).toBe(200);
    expect(res.body.data.seller.businessName).toBe('Pune Motors');
  });
});
