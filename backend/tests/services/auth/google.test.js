/**
 * Google sign-in (PRD F4) and adding a phone later (decided 17 Nov 2026):
 * - only verified Google identities are accepted; staff accounts are never entered
 * - an existing account is linked only when its email was verified
 * - a Google account adds a verified phone once; a number on another account is refused
 */
jest.mock('../../../src/config/firebase', () => ({ getFirebaseAuth: jest.fn() }));
jest.mock('../../../src/services/auth/session.service', () => ({
  startSession: jest.fn(async () => ({ accessToken: 'a', refreshToken: 'r' })),
  rotateRefreshToken: jest.fn(),
  revokeByRefreshToken: jest.fn(),
}));
jest.mock('../../../src/services/user.service', () => ({
  toAppUser: jest.fn((user) => ({ id: String(user._id), phone: user.phone ?? null })),
  getAppRoles: jest.fn(async () => ['buyer']),
  getUserById: jest.fn(),
}));

const { Types } = require('mongoose');
const User = require('../../../src/models/user.model');
const { getFirebaseAuth } = require('../../../src/config/firebase');
const { startSession } = require('../../../src/services/auth/session.service');
const auth = require('../../../src/services/auth/auth.service');

const TOKEN = 'x'.repeat(120);
const googleToken = (extra = {}) => ({
  uid: 'g-uid-1',
  email: 'Asha@Gmail.com',
  email_verified: true,
  name: 'Asha Patil',
  firebase: { sign_in_provider: 'google.com' },
  ...extra,
});
const firebaseReturns = (decoded) =>
  getFirebaseAuth.mockReturnValue({ verifyIdToken: jest.fn(async () => decoded) });
const selectable = (value) => ({ select: async () => value });

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.spyOn(User, 'updateOne').mockResolvedValue({});
});

describe('verifyGoogleLogin', () => {
  it('creates a new account with the verified email and starts a session', async () => {
    firebaseReturns(googleToken());
    jest
      .spyOn(User, 'findOne')
      .mockImplementation((filter) => (filter.email ? selectable(null) : Promise.resolve(null)));
    const create = jest
      .spyOn(User, 'create')
      .mockImplementation(async (doc) => ({ _id: new Types.ObjectId(), status: 'active', ...doc }));

    const result = await auth.verifyGoogleLogin({
      idToken: TOKEN,
      context: { deviceId: 'device-1234' },
    });

    expect(create.mock.calls[0][0]).toMatchObject({
      email: 'asha@gmail.com',
      googleUid: 'g-uid-1',
      name: 'Asha Patil',
      emailVerifiedAt: expect.any(Date),
    });
    expect(result.isNewUser).toBe(true);
    expect(result.user.phone).toBeNull(); // phone comes later, before paying
    expect(startSession).toHaveBeenCalledWith(
      expect.objectContaining({ audience: 'saathmein-app' }),
    );
  });

  it('signs in the account already linked to this Google identity', async () => {
    firebaseReturns(googleToken());
    const existing = {
      _id: new Types.ObjectId(),
      status: 'active',
      googleUid: 'g-uid-1',
      phone: '+919800000001',
    };
    jest.spyOn(User, 'findOne').mockResolvedValue(existing);
    const result = await auth.verifyGoogleLogin({ idToken: TOKEN, context: {} });
    expect(result.isNewUser).toBe(false);
    expect(result.user.phone).toBe('+919800000001');
  });

  it('links an existing account only when its email was verified', async () => {
    firebaseReturns(googleToken());
    const verified = {
      _id: new Types.ObjectId(),
      status: 'active',
      email: 'asha@gmail.com',
      emailVerifiedAt: new Date(),
    };
    jest
      .spyOn(User, 'findOne')
      .mockImplementation((filter) =>
        filter.email ? selectable(verified) : Promise.resolve(null),
      );
    await auth.verifyGoogleLogin({ idToken: TOKEN, context: {} });
    expect(User.updateOne.mock.calls[0][1]).toEqual({ $set: { googleUid: 'g-uid-1' } });

    const unverified = { ...verified, emailVerifiedAt: undefined };
    jest
      .spyOn(User, 'findOne')
      .mockImplementation((filter) =>
        filter.email ? selectable(unverified) : Promise.resolve(null),
      );
    await expect(auth.verifyGoogleLogin({ idToken: TOKEN, context: {} })).rejects.toMatchObject({
      code: 'EMAIL_TAKEN',
    });
  });

  it('never signs into a staff account', async () => {
    firebaseReturns(googleToken());
    const staff = {
      _id: new Types.ObjectId(),
      status: 'active',
      staffRole: 'admin',
      emailVerifiedAt: new Date(),
    };
    jest
      .spyOn(User, 'findOne')
      .mockImplementation((filter) => (filter.email ? selectable(staff) : Promise.resolve(null)));
    await expect(auth.verifyGoogleLogin({ idToken: TOKEN, context: {} })).rejects.toMatchObject({
      code: 'STAFF_ACCOUNT',
    });
  });

  it('refuses phone tokens and unverified Google emails', async () => {
    firebaseReturns(googleToken({ firebase: { sign_in_provider: 'phone' } }));
    await expect(auth.verifyGoogleLogin({ idToken: TOKEN, context: {} })).rejects.toMatchObject({
      code: 'GOOGLE_LOGIN_REQUIRED',
    });
    firebaseReturns(googleToken({ email_verified: false }));
    await expect(auth.verifyGoogleLogin({ idToken: TOKEN, context: {} })).rejects.toMatchObject({
      code: 'GOOGLE_EMAIL_UNVERIFIED',
    });
  });
});

describe('linkPhone', () => {
  const userId = new Types.ObjectId();
  const phoneToken = {
    uid: 'p-uid',
    phone_number: '+919812345678',
    firebase: { sign_in_provider: 'phone' },
  };

  it('adds the verified phone to the account', async () => {
    firebaseReturns(phoneToken);
    jest
      .spyOn(User, 'findById')
      .mockResolvedValueOnce({ _id: userId })
      .mockResolvedValueOnce({ _id: userId, phone: '+919812345678' });
    jest.spyOn(User, 'exists').mockResolvedValue(null);
    const user = await auth.linkPhone(String(userId), TOKEN);
    expect(User.updateOne.mock.calls[0][1]).toEqual({
      $set: { phone: '+919812345678', firebaseUid: 'p-uid' },
    });
    expect(user.phone).toBe('+919812345678');
  });

  it('refuses a number that belongs to another account', async () => {
    firebaseReturns(phoneToken);
    jest.spyOn(User, 'findById').mockResolvedValue({ _id: userId });
    jest.spyOn(User, 'exists').mockResolvedValue({ _id: 'other' });
    await expect(auth.linkPhone(String(userId), TOKEN)).rejects.toMatchObject({
      code: 'PHONE_IN_USE',
    });
    expect(User.updateOne).not.toHaveBeenCalled();
  });
});
