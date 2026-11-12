/**
 * Day 11 routes: home feed for guests, Admin → Curation / Settings are Owner + Admin only,
 * settings validation per section, banner links must be in-app paths, and maintenance mode
 * blocks buyer changes but not reads or the admin console.
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
jest.mock('../../src/services/feed/feed.service', () => ({
  getHomeFeed: jest.fn(async () => ({ cityId: null, banners: [], sections: [], categories: [] })),
}));
jest.mock('../../src/services/admin/curation.service', () => ({
  listItems: jest.fn(async () => []),
  createItem: jest.fn(async (input) => ({ id: 'i1', ...input })),
}));
jest.mock('../../src/services/admin/adminSettings.service', () => ({
  ...jest.requireActual('../../src/services/admin/adminSettings.service'),
  getAllSettings: jest.fn(async () => ({})),
}));
jest.mock('../../src/services/settings.service', () => ({
  ...jest.requireActual('../../src/services/settings.service'),
  getFeatureFlags: jest.fn(async () => ({ maintenanceMode: false })),
}));

const request = require('supertest');
const { Types } = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const curation = require('../../src/services/admin/curation.service');
const { getFeatureFlags } = require('../../src/services/settings.service');
const { signAccessToken } = require('../../src/services/auth/token.service');
const { TOKEN_AUDIENCE, STAFF_ROLE } = require('../../src/constants/enums');

const userId = new Types.ObjectId().toString();
const sessionId = new Types.ObjectId().toString();
const staffToken = (staffRole) =>
  signAccessToken({ userId, sessionId, audience: TOKEN_AUDIENCE.STAFF, claims: { staffRole } })
    .token;
const staffIs = (staffRole) =>
  User.findById.mockReturnValue({ select: () => Promise.resolve({ staffRole, status: 'active' }) });
const asStaff = (role) => ({
  Authorization: `Bearer ${staffToken(role)}`,
  'X-Requested-With': 'XMLHttpRequest',
});

beforeEach(() => jest.clearAllMocks());

it('home feed works for guests', async () => {
  const res = await request(app).get('/api/feed/home');
  expect(res.status).toBe(200);
});

describe('Admin → Curation and Settings', () => {
  it.each([
    [STAFF_ROLE.SUPPORT, 403],
    [STAFF_ROLE.FINANCE, 403],
    [STAFF_ROLE.DEAL_MANAGER, 403],
    [STAFF_ROLE.ADMIN, 200],
    [STAFF_ROLE.OWNER, 200],
  ])('%s → %i', async (role, status) => {
    staffIs(role);
    const curationRes = await request(app).get('/api/admin/curation').set(asStaff(role));
    const settingsRes = await request(app).get('/api/admin/settings').set(asStaff(role));
    expect(curationRes.status).toBe(status);
    expect(settingsRes.status).toBe(status);
  });

  it('banner links must be in-app paths', async () => {
    staffIs(STAFF_ROLE.ADMIN);
    const bad = await request(app)
      .post('/api/admin/curation')
      .set(asStaff(STAFF_ROLE.ADMIN))
      .send({ type: 'banner', title: 'Sale', linkPath: 'https://evil.example' });
    expect(bad.status).toBe(422);
    const ok = await request(app)
      .post('/api/admin/curation')
      .set(asStaff(STAFF_ROLE.ADMIN))
      .send({ type: 'banner', title: 'Sale', linkPath: '/groups/browse?type=seller_led' });
    expect(ok.status).toBe(201);
    expect(curation.createItem).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid settings values and unknown sections', async () => {
    staffIs(STAFF_ROLE.ADMIN);
    const bad = await request(app)
      .patch('/api/admin/settings/referrals')
      .set(asStaff(STAFF_ROLE.ADMIN))
      .send({ friendCreditPaise: 99.5 });
    expect(bad.status).toBe(422);
    const unknown = await request(app)
      .patch('/api/admin/settings/secrets')
      .set(asStaff(STAFF_ROLE.ADMIN))
      .send({});
    expect(unknown.status).toBe(422);
  });
});

describe('maintenance mode', () => {
  it('blocks changes with 503 but keeps reads and admin working', async () => {
    getFeatureFlags.mockResolvedValue({ maintenanceMode: true });
    const write = await request(app).post('/api/reviews').send({});
    expect(write.status).toBe(503);
    expect(write.body.error.code).toBe('MAINTENANCE');

    const read = await request(app).get('/api/feed/home');
    expect(read.status).toBe(200);

    staffIs(STAFF_ROLE.ADMIN);
    const admin = await request(app)
      .post('/api/admin/curation')
      .set(asStaff(STAFF_ROLE.ADMIN))
      .send({ type: 'banner', title: 'Back soon' });
    expect(admin.status).toBe(201);
    getFeatureFlags.mockResolvedValue({ maintenanceMode: false });
  });
});
