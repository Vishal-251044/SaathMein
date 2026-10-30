/**
 * Group routes (Day 6): creating needs a login and a valid body; browsing is public;
 * admin Groups is read-only for Owner/Admin/Deal Manager/Support (Finance gets 403) and
 * exports CSV (MON-1).
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
jest.mock('../../src/models/auditLog.model', () => ({ create: jest.fn() }));
jest.mock('../../src/services/groups/group.service', () => ({
  createGroup: jest.fn(async () => ({ id: 'g1' })),
  listGroups: jest.fn(async () => ({ groups: [], meta: { page: 1 } })),
}));
jest.mock('../../src/services/groups/groupAdmin.service', () => ({
  listAdminGroups: jest.fn(async () => ({ groups: [{ id: 'g1' }], meta: {} })),
  exportAdminGroupsCsv: jest.fn(async () => 'Group ID\r\ng1\r\n'),
}));

const request = require('supertest');
const { Types } = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const groupService = require('../../src/services/groups/group.service');
const { signAccessToken } = require('../../src/services/auth/token.service');
const { TOKEN_AUDIENCE, STAFF_ROLE } = require('../../src/constants/enums');

const userId = new Types.ObjectId().toString();
const sessionId = new Types.ObjectId().toString();
const buyerToken = () =>
  signAccessToken({ userId, sessionId, audience: TOKEN_AUDIENCE.APP, claims: { roles: ['buyer'] } })
    .token;
const staffToken = (staffRole) =>
  signAccessToken({ userId, sessionId, audience: TOKEN_AUDIENCE.STAFF, claims: { staffRole } })
    .token;
const staffIs = (staffRole) =>
  User.findById.mockReturnValue({ select: () => Promise.resolve({ staffRole, status: 'active' }) });

const body = {
  productId: new Types.ObjectId().toString(),
  variantKey: null,
  targetSize: 10,
  deadlineDays: 7,
  visibility: 'public',
};

describe('/api/groups', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lets anyone browse public groups', async () => {
    const res = await request(app).get('/api/groups?sort=filling');
    expect(res.status).toBe(200);
    expect(groupService.listGroups).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'filling' }),
      {
        userId: undefined,
      },
    );
  });

  it('needs a login to create a group', async () => {
    expect((await request(app).post('/api/groups').send(body)).status).toBe(401);
  });

  it('rejects client-sent money and unknown fields', async () => {
    const res = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${buyerToken()}`)
      .send({ ...body, tokenAmountPaise: 1 });
    expect(res.status).toBe(422); // validation error
    expect(groupService.createGroup).not.toHaveBeenCalled();
  });

  it('creates a group for a logged-in buyer', async () => {
    const res = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${buyerToken()}`)
      .send(body);
    expect(res.status).toBe(201);
    expect(groupService.createGroup).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ targetSize: 10 }),
    );
  });
});

describe('/api/admin/groups', () => {
  it.each([
    [STAFF_ROLE.FINANCE, 403],
    [STAFF_ROLE.SUPPORT, 200],
    [STAFF_ROLE.DEAL_MANAGER, 200],
    [STAFF_ROLE.ADMIN, 200],
    [STAFF_ROLE.OWNER, 200],
  ])('%s → %i', async (role, status) => {
    staffIs(role);
    const res = await request(app)
      .get('/api/admin/groups')
      .set('Authorization', `Bearer ${staffToken(role)}`);
    expect(res.status).toBe(status);
  });

  it('exports CSV', async () => {
    staffIs(STAFF_ROLE.SUPPORT);
    const res = await request(app)
      .get('/api/admin/groups?format=csv&status=open')
      .set('Authorization', `Bearer ${staffToken(STAFF_ROLE.SUPPORT)}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('g1');
  });

  it('gives buyers 403', async () => {
    const res = await request(app)
      .get('/api/admin/groups')
      .set('Authorization', `Bearer ${buyerToken()}`);
    expect(res.status).toBe(403);
  });
});
