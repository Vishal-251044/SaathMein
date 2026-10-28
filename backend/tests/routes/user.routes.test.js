/**
 * Route tests for /api/users/me, public catalog routes and /api/admin/cities permissions.
 * Services are mocked; these tests check auth, validation and role rules.
 */
jest.mock('../../src/config/db', () => ({
  ...jest.requireActual('../../src/config/db'),
  getDBStatus: () => 'connected',
}));
jest.mock('../../src/services/profile.service', () => ({
  getActiveUser: jest.fn(),
  updateProfile: jest.fn(async () => ({ id: 'u1' })),
  saveInterests: jest.fn(async () => ({ id: 'u1' })),
  deleteAccount: jest.fn(),
}));
jest.mock('../../src/services/city.service', () => ({
  ...jest.requireActual('../../src/services/city.service'),
  listAllCities: jest.fn(async () => []),
  matchLocation: jest.fn(async () => ({ city: null, area: null })),
}));
jest.mock('../../src/services/auth/session.service', () => ({
  ...jest.requireActual('../../src/services/auth/session.service'),
  assertStaffSessionActive: jest.fn(async () => ({})),
}));
jest.mock('../../src/models/user.model', () => ({ findById: jest.fn() }));

const request = require('supertest');
const { Types } = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const profileService = require('../../src/services/profile.service');
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

describe('/api/users/me', () => {
  it('requires login', async () => {
    expect((await request(app).get('/api/users/me')).status).toBe(401);
    expect((await request(app).delete('/api/users/me')).status).toBe(401);
  });

  it('validates profile updates (unknown fields, bad pincode, empty body)', async () => {
    const auth = { Authorization: `Bearer ${buyerToken}` };
    expect(
      (await request(app).patch('/api/users/me').set(auth).send({ role: 'owner' })).status,
    ).toBe(422);
    expect(
      (await request(app).patch('/api/users/me').set(auth).send({ pincode: '12' })).status,
    ).toBe(422);
    expect((await request(app).patch('/api/users/me').set(auth).send({})).status).toBe(422);

    const ok = await request(app)
      .patch('/api/users/me')
      .set(auth)
      .send({ name: 'Priya', language: 'hi' });
    expect(ok.status).toBe(200);
    expect(profileService.updateProfile).toHaveBeenCalledWith(userId, {
      name: 'Priya',
      language: 'hi',
    });
  });

  it('rejects a budget whose minimum is above the maximum', async () => {
    const res = await request(app)
      .post('/api/users/me/interests')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ categories: [], budgetMinPaise: 500000, budgetMaxPaise: 100000 });
    expect(res.status).toBe(422);
  });

  it('rejects rupee floats — budgets must be integer paise', async () => {
    const res = await request(app)
      .post('/api/users/me/interests')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ budgetMaxPaise: 1500.5 });
    expect(res.status).toBe(422);
  });

  it('deletes the account for the logged-in user only', async () => {
    const res = await request(app)
      .delete('/api/users/me')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
    expect(profileService.deleteAccount).toHaveBeenCalledWith(userId);
  });
});

describe('public catalog routes', () => {
  it('requires a pincode or coordinates for city matching', async () => {
    expect((await request(app).get('/api/cities/match')).status).toBe(422);
    expect((await request(app).get('/api/cities/match?pincode=411038')).status).toBe(200);
  });
});

describe('/api/admin/cities permissions', () => {
  it('lets Owner, Admin and Deal Manager in, and keeps Support and Finance out', async () => {
    const auth = { Authorization: `Bearer ${staffToken}` };
    for (const role of ['owner', 'admin', 'deal_manager']) {
      staffRoleIs(role);
      expect((await request(app).get('/api/admin/cities').set(auth)).status).toBe(200);
    }
    for (const role of ['support', 'finance']) {
      staffRoleIs(role);
      expect((await request(app).get('/api/admin/cities').set(auth)).status).toBe(403);
    }
  });

  it('gives buyers 403', async () => {
    const res = await request(app)
      .get('/api/admin/cities')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(403);
  });
});
