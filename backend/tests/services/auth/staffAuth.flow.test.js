/**
 * End-to-end test of the staff login service with mocked models:
 * password → mandatory 2FA setup → session + backup codes → later login with TOTP,
 * replay rejection, backup code use, lockout after 5 failures and the new-device email
 * (ADL-4).
 */
jest.mock('../../../src/models/user.model', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../../../src/services/auth/session.service', () => ({
  startSession: jest.fn(async () => ({
    accessToken: 'access',
    accessTokenExpiresAt: new Date(),
    refreshToken: 'refresh',
    refreshTokenExpiresAt: new Date(),
  })),
  rotateRefreshToken: jest.fn(),
  revokeByRefreshToken: jest.fn(),
}));
jest.mock('../../../src/models/session.model', () => ({ exists: jest.fn(async () => null) }));
jest.mock('../../../src/services/email.service', () => ({
  sendStaffNewDevice: jest.fn(async () => ({ sent: true })),
}));

const bcrypt = require('bcrypt');
const { generate } = require('otplib');
const { Types } = require('mongoose');
const User = require('../../../src/models/user.model');
const {
  startSession,
  revokeByRefreshToken,
} = require('../../../src/services/auth/session.service');
const Session = require('../../../src/models/session.model');
const { sendStaffNewDevice } = require('../../../src/services/email.service');
const staffAuth = require('../../../src/services/auth/staffAuth.service');

const PASSWORD = 'Correct-Horse-42!';

/**
 * In-memory staff user; User.updateOne applies $set/$unset to it like MongoDB would.
 * @returns {Object} Mutable user document
 */
const createStaffUser = async () => ({
  _id: new Types.ObjectId(),
  email: 'owner@saathmein.in',
  name: 'Vishal',
  staffRole: 'owner',
  status: 'active',
  passwordHash: await bcrypt.hash(PASSWORD, 4),
  twoFactorEnabled: false,
  failedLoginCount: 0,
});

/** Apply a Mongo-style update to the in-memory user (supports dotted array paths). */
const applyUpdate = (user, update) => {
  const set = update.$set || {};
  Object.entries(set).forEach(([path, value]) => {
    const parts = path.split('.');
    let target = user;
    parts.slice(0, -1).forEach((part) => {
      target = target[part];
    });
    target[parts.at(-1)] = value;
  });
  Object.keys(update.$unset || {}).forEach((key) => delete user[key]);
};

describe('staff login flow', () => {
  let user;

  beforeEach(async () => {
    user = await createStaffUser();
    const query = () => ({ select: () => Promise.resolve(user) });
    User.findOne.mockImplementation(query);
    User.updateOne.mockImplementation(async (_filter, update) => applyUpdate(user, update));
    startSession.mockClear();
  });

  it('requires 2FA setup on first login, then issues a session and backup codes', async () => {
    const step1 = await staffAuth.loginWithPassword({ email: user.email, password: PASSWORD });
    expect(step1.step).toBe('setup_2fa');
    expect(step1.setup.otpAuthUrl).toContain('otpauth://totp/');
    expect(user.twoFactorPendingSecret).toBeDefined();
    expect(user.twoFactorPendingSecret).not.toContain(step1.setup.secret); // encrypted at rest

    const code = await generate({ secret: step1.setup.secret });
    const step2 = await staffAuth.verifySecondFactor({
      challengeToken: step1.challengeToken,
      code,
      context: { ip: '127.0.0.1' },
    });

    expect(step2.staff).toMatchObject({ email: user.email, role: 'owner', twoFactorEnabled: true });
    expect(step2.backupCodes).toHaveLength(10);
    expect(user.twoFactorEnabled).toBe(true);
    expect(user.twoFactorPendingSecret).toBeUndefined();
    expect(startSession).toHaveBeenCalledWith(
      expect.objectContaining({ audience: 'saathmein-staff', claims: { staffRole: 'owner' } }),
    );

    // Second login: password, then TOTP (the setup code cannot be replayed)
    const again = await staffAuth.loginWithPassword({ email: user.email, password: PASSWORD });
    expect(again.step).toBe('verify_2fa');
    await expect(
      staffAuth.verifySecondFactor({ challengeToken: again.challengeToken, code, context: {} }),
    ).rejects.toMatchObject({ code: 'INVALID_2FA_CODE' });

    // A backup code works exactly once
    const backup = step2.backupCodes[0];
    await expect(
      staffAuth.verifySecondFactor({
        challengeToken: again.challengeToken,
        code: backup,
        context: {},
      }),
    ).resolves.toHaveProperty('staff');
    await expect(
      staffAuth.verifySecondFactor({
        challengeToken: again.challengeToken,
        code: backup,
        context: {},
      }),
    ).rejects.toMatchObject({ code: 'INVALID_2FA_CODE' });
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    await expect(
      staffAuth.loginWithPassword({ email: user.email, password: 'wrong-password' }),
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });

    User.findOne.mockImplementation(() => ({ select: () => Promise.resolve(null) }));
    await expect(
      staffAuth.loginWithPassword({ email: 'nobody@saathmein.in', password: PASSWORD }),
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('locks the account after 5 wrong passwords, even for the right password', async () => {
    for (let i = 0; i < staffAuth.MAX_FAILED_ATTEMPTS; i += 1) {
      await expect(
        staffAuth.loginWithPassword({ email: user.email, password: 'wrong-password' }),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    }
    expect(user.lockUntil.getTime()).toBeGreaterThan(Date.now());

    await expect(
      staffAuth.loginWithPassword({ email: user.email, password: PASSWORD }),
    ).rejects.toMatchObject({ statusCode: 429, code: 'ACCOUNT_LOCKED' });
  });

  it('blocks suspended staff', async () => {
    user.status = 'suspended';
    await expect(
      staffAuth.loginWithPassword({ email: user.email, password: PASSWORD }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('emails the staff member when they sign in from a browser not used before (ADL-4)', async () => {
    const step1 = await staffAuth.loginWithPassword({ email: user.email, password: PASSWORD });
    const code = await generate({ secret: step1.setup.secret });
    // First ever login: no history → no email
    const first = await staffAuth.verifySecondFactor({
      challengeToken: step1.challengeToken,
      code,
      context: { ip: '1.2.3.4', userAgent: 'Laptop Chrome' },
    });
    expect(sendStaffNewDevice).not.toHaveBeenCalled();

    // Later login from an unknown browser: history exists, this user agent does not
    Session.exists.mockImplementation(async (filter) => (filter.userAgent ? null : { _id: 's' }));
    const again = await staffAuth.loginWithPassword({ email: user.email, password: PASSWORD });
    await staffAuth.verifySecondFactor({
      challengeToken: again.challengeToken,
      code: first.backupCodes[0],
      context: { ip: '5.6.7.8', userAgent: 'Unknown phone' },
    });
    expect(sendStaffNewDevice).toHaveBeenCalledWith(
      expect.objectContaining({ to: user.email, ip: '5.6.7.8', device: 'Unknown phone' }),
    );
    Session.exists.mockImplementation(async () => null);
  });

  it('logout returns who signed out (for the audit log), or null for a dead session', async () => {
    revokeByRefreshToken.mockResolvedValueOnce(String(user._id));
    User.findById.mockReturnValueOnce({
      select: () => ({ lean: async () => ({ staffRole: 'finance' }) }),
    });
    await expect(staffAuth.logoutStaff('rt')).resolves.toEqual({
      userId: String(user._id),
      role: 'finance',
    });
    revokeByRefreshToken.mockResolvedValueOnce(null);
    await expect(staffAuth.logoutStaff('dead')).resolves.toBeNull();
  });
});
