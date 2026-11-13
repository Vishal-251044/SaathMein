/**
 * Admin Console permission matrix (PRD §8.2, Day 13 "Done when"): every monitor, action,
 * alert, Team, Settings and audit route is checked for every staff role. The API is the
 * security (UI hiding is not): Support gets 403 on Payments, Settings and Team.
 * Services are mocked; this suite only checks who gets through the guards.
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
jest.mock('../../src/services/audit.service', () => ({
  ...jest.requireActual('../../src/services/audit.service'),
  recordAudit: jest.fn(),
  listAuditLogs: jest.fn(async () => ({ entries: [], meta: {} })),
}));
jest.mock('../../src/services/monitor/monitor.service', () => ({
  getOverview: jest.fn(async () => ({})),
  getGroupsMonitor: jest.fn(async () => ({})),
  listAuctions: jest.fn(async () => ({ auctions: [], meta: {} })),
  getAuctionDetail: jest.fn(async () => ({})),
  listDealers: jest.fn(async () => ({ dealers: [], meta: {} })),
  getBuyersMonitor: jest.fn(async () => ({ buyers: [], meta: {} })),
  getDisputesMonitor: jest.fn(async () => ({})),
  getSystemHealth: jest.fn(async () => ({})),
  retryFailedJobs: jest.fn(async () => 0),
}));
jest.mock('../../src/services/monitor/paymentMonitor.service', () => ({
  getPaymentMonitor: jest.fn(async () => ({})),
  listPayments: jest.fn(async () => ({ payments: [], meta: {} })),
}));
jest.mock('../../src/services/admin/staffActions.service', () => {
  const done = jest.fn(async () => ({ before: {}, after: {} }));
  return new Proxy({}, { get: () => done });
});
jest.mock('../../src/services/admin/staffTeam.service', () => ({
  listTeam: jest.fn(async () => ({ members: [], invites: [] })),
  inviteStaff: jest.fn(async () => ({ id: 'i', email: 'a@b.in', role: 'support' })),
  revokeInvite: jest.fn(),
  changeRole: jest.fn(async () => ({ before: {}, after: {} })),
  setMemberActive: jest.fn(async () => ({ before: {}, after: {} })),
}));
jest.mock('../../src/services/alerts/alert.service', () => ({
  raiseAlert: jest.fn(),
  listAlerts: jest.fn(async () => ({ alerts: [], openCount: 0, meta: {} })),
  updateAlert: jest.fn(async () => ({ status: 'ack' })),
}));
jest.mock('../../src/services/payments/commission.service', () => ({
  listCommissions: jest.fn(async () => ({ commissions: [], totals: {}, meta: {} })),
}));
jest.mock('../../src/services/admin/adminSettings.service', () => ({
  getAllSettings: jest.fn(async () => ({})),
  updateSettings: jest.fn(async () => ({ before: {}, after: {} })),
}));

const request = require('supertest');
const { Types } = require('mongoose');
const User = require('../../src/models/user.model');
const { signAccessToken } = require('../../src/services/auth/token.service');
const app = require('../../src/app');
const { TOKEN_AUDIENCE, STAFF_ROLE: R } = require('../../src/constants/enums');

const userId = new Types.ObjectId().toString();
const sessionId = new Types.ObjectId().toString();
const id = new Types.ObjectId().toString();
const reason = 'Checked with the dealer on the phone';
const ROLES = [R.OWNER, R.ADMIN, R.DEAL_MANAGER, R.FINANCE, R.SUPPORT];
const ALL = ROLES;
const OPS = [R.OWNER, R.ADMIN, R.DEAL_MANAGER];
const OPS_VIEW = [...OPS, R.SUPPORT];
const FINANCE = [R.OWNER, R.ADMIN, R.FINANCE];
const SUPPORT = [R.OWNER, R.ADMIN, R.SUPPORT];
const ADMIN = [R.OWNER, R.ADMIN];
const OWNER = [R.OWNER];

const staffToken = (staffRole) =>
  signAccessToken({ userId, sessionId, audience: TOKEN_AUDIENCE.STAFF, claims: { staffRole } })
    .token;

// [method, path, body, allowed roles]
const MATRIX = [
  ['get', '/monitor/overview', null, ALL],
  ['get', '/alerts', null, ALL],
  ['patch', `/alerts/${id}`, { action: 'ack' }, ALL],
  ['get', '/monitor/groups', null, OPS_VIEW],
  ['get', '/monitor/auctions', null, OPS_VIEW],
  ['get', `/monitor/auctions/${id}`, null, OPS_VIEW],
  ['post', `/monitor/auctions/${id}/pause`, { reason }, OPS],
  ['post', `/monitor/auctions/${id}/resume`, { reason }, OPS],
  ['post', `/monitor/auctions/${id}/extend`, { hours: 2, reason }, OPS],
  ['post', `/monitor/auctions/${id}/runner-up`, { reason, penalise: true }, OPS],
  ['post', `/monitor/groups/${id}/cancel`, { reason }, OPS],
  ['post', `/monitor/groups/${id}/extend`, { days: 3, reason }, OPS],
  ['get', '/monitor/payments/summary', null, FINANCE],
  ['get', '/monitor/payments', null, FINANCE],
  ['post', `/monitor/payments/${id}/retry-refund`, { reason }, FINANCE],
  ['post', `/monitor/payments/${id}/refund`, { amountPaise: 1000, reason }, FINANCE],
  ['post', `/monitor/payments/${id}/release-hold`, { reason }, FINANCE],
  ['post', `/monitor/payments/${id}/reverse-hold`, { reason }, FINANCE],
  ['get', '/monitor/dealers', null, OPS_VIEW],
  ['post', `/monitor/dealers/${id}/penalties`, { type: 'warning', reason }, OPS],
  ['post', `/monitor/dealers/${id}/penalties/${id}/lift`, { reason }, OPS],
  ['get', '/monitor/buyers', null, SUPPORT],
  ['post', `/monitor/buyers/${id}/status`, { active: false, reason }, SUPPORT],
  ['get', '/monitor/disputes', null, SUPPORT],
  ['get', '/monitor/system', null, ADMIN],
  ['post', '/monitor/system/queues/refunds/retry', { reason }, ADMIN],
  ['get', '/team', null, OWNER],
  ['post', '/team/invites', { email: 'new.staff@example.com', role: 'support' }, OWNER],
  ['delete', `/team/invites/${id}`, null, OWNER],
  ['patch', `/team/${id}/role`, { role: 'finance', reason }, OWNER],
  ['patch', `/team/${id}/status`, { active: false, reason }, OWNER],
  ['get', '/settings', null, ADMIN],
  ['get', '/audit-logs', null, ADMIN],
  ['get', '/commissions', null, FINANCE],
];

const cases = MATRIX.flatMap(([method, path, body, allowed]) =>
  ROLES.map((role) => [method.toUpperCase(), path, role, allowed.includes(role), body]),
);

describe('admin permission matrix', () => {
  it.each(cases)('%s %s as %s → allowed=%s', async (method, path, role, allowed, body) => {
    User.findById.mockReturnValue({
      select: () => Promise.resolve({ staffRole: role, status: 'active' }),
    });
    let req = request(app)
      [method.toLowerCase()](`/api/admin${path}`)
      .set('Authorization', `Bearer ${staffToken(role)}`)
      .set('X-Requested-With', 'XMLHttpRequest');
    if (body) req = req.send(body);
    const res = await req;
    if (allowed) {
      expect(res.status).toBeLessThan(400);
    } else {
      expect(res.status).toBe(403);
    }
  });

  it('Support gets 403 on Payments, Settings and Team (Day 13 "Done when")', async () => {
    User.findById.mockReturnValue({
      select: () => Promise.resolve({ staffRole: R.SUPPORT, status: 'active' }),
    });
    for (const path of ['/monitor/payments', '/settings', '/team']) {
      const res = await request(app)
        .get(`/api/admin${path}`)
        .set('Authorization', `Bearer ${staffToken(R.SUPPORT)}`);
      expect(res.status).toBe(403);
    }
  });

  it('every staff action needs a reason note', async () => {
    User.findById.mockReturnValue({
      select: () => Promise.resolve({ staffRole: R.OWNER, status: 'active' }),
    });
    const res = await request(app)
      .post(`/api/admin/monitor/groups/${id}/cancel`)
      .set('Authorization', `Bearer ${staffToken(R.OWNER)}`)
      .send({ reason: 'short' });
    expect(res.status).toBe(422);
  });
});
