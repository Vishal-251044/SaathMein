/**
 * Dealer auth and team (F30, Day 5): sign-up creates user + seller + owner membership,
 * login rules (staff and non-dealers refused, lockout), email code checks, and team rules
 * (one team per person, owner cannot be removed).
 */
jest.mock('../../../src/models/user.model', () => ({
  exists: jest.fn(),
  create: jest.fn(),
  deleteOne: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../../../src/models/seller.model', () => ({ create: jest.fn(), findById: jest.fn() }));
jest.mock('../../../src/models/sellerStaff.model', () => ({
  create: jest.fn(),
  exists: jest.fn(),
  findOne: jest.fn(),
  countDocuments: jest.fn(),
  find: jest.fn(),
}));
jest.mock('../../../src/models/sellerInvite.model', () => ({}));
jest.mock('../../../src/services/auth/session.service', () => ({
  startSession: jest.fn(async () => ({ accessToken: 'access', refreshToken: 'refresh' })),
  rotateRefreshToken: jest.fn(),
  revokeByRefreshToken: jest.fn(),
}));
jest.mock('../../../src/services/user.service', () => ({
  getAppRoles: jest.fn(async () => ['buyer', 'seller']),
  getUserById: jest.fn(),
}));
jest.mock('../../../src/services/rateLimit.service', () => ({ assertWithinLimit: jest.fn() }));
jest.mock('../../../src/services/email.service', () => ({
  sendEmailVerificationCode: jest.fn(async () => ({ sent: true })),
  sendTeamInvite: jest.fn(),
}));

const bcrypt = require('bcrypt');
const { Types } = require('mongoose');
const User = require('../../../src/models/user.model');
const Seller = require('../../../src/models/seller.model');
const SellerStaff = require('../../../src/models/sellerStaff.model');
const { startSession } = require('../../../src/services/auth/session.service');
const emailService = require('../../../src/services/email.service');
const sellerAuth = require('../../../src/services/seller/sellerAuth.service');
const sellerTeam = require('../../../src/services/seller/sellerTeam.service');

const PASSWORD = 'dealer-pass-2026';

const chain = (value) => ({
  select: () => chain(value),
  lean: async () => value,
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
});

describe('registerDealer', () => {
  beforeEach(() => jest.clearAllMocks());

  it('refuses an email that already has an account', async () => {
    User.exists.mockResolvedValue(true);
    await expect(
      sellerAuth.registerDealer({ email: 'a@b.in', password: PASSWORD }, {}),
    ).rejects.toMatchObject({ statusCode: 409, code: 'EMAIL_TAKEN' });
  });

  it('creates the user, the seller and the owner membership, then emails a code', async () => {
    const userId = new Types.ObjectId();
    const sellerId = new Types.ObjectId();
    User.exists.mockResolvedValue(null);
    User.create.mockImplementation(async (doc) => ({ _id: userId, ...doc }));
    Seller.create.mockResolvedValue({ _id: sellerId });

    const { user, tokens } = await sellerAuth.registerDealer(
      {
        name: 'Ravi',
        email: 'ravi@shreemotors.in',
        password: PASSWORD,
        businessName: 'Shree Motors',
        phone: '+919876543210',
      },
      {},
    );

    expect(User.create.mock.calls[0][0].passwordHash).not.toBe(PASSWORD);
    expect(User.create.mock.calls[0][0].phone).toBeUndefined(); // phone is not a login
    expect(Seller.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerUserId: userId, contactPhone: '+919876543210' }),
    );
    expect(SellerStaff.create).toHaveBeenCalledWith({ sellerId, userId, role: 'owner' });
    expect(emailService.sendEmailVerificationCode).toHaveBeenCalled();
    expect(startSession).toHaveBeenCalledWith(
      expect.objectContaining({ claims: { roles: ['buyer', 'seller'] } }),
    );
    expect(user).toMatchObject({ email: 'ravi@shreemotors.in', emailVerified: false });
    expect(tokens.accessToken).toBe('access');
  });

  it('removes the user again if the seller cannot be created', async () => {
    User.exists.mockResolvedValue(null);
    User.create.mockImplementation(async (doc) => ({ _id: new Types.ObjectId(), ...doc }));
    Seller.create.mockRejectedValue(new Error('db down'));
    await expect(
      sellerAuth.registerDealer(
        {
          name: 'R',
          email: 'r@b.in',
          password: PASSWORD,
          businessName: 'Shop',
          phone: '+919876543210',
        },
        {},
      ),
    ).rejects.toThrow('db down');
    expect(User.deleteOne).toHaveBeenCalled();
  });
});

describe('loginDealer', () => {
  let user;

  beforeEach(async () => {
    jest.clearAllMocks();
    user = {
      _id: new Types.ObjectId(),
      email: 'ravi@shreemotors.in',
      status: 'active',
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      failedLoginCount: 0,
    };
    User.findOne.mockReturnValue({ select: async () => user });
    SellerStaff.exists.mockResolvedValue(true);
  });

  it('logs a dealer in', async () => {
    const { user: dealer } = await sellerAuth.loginDealer(
      { email: user.email, password: PASSWORD },
      {},
    );
    expect(dealer.email).toBe(user.email);
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    await expect(
      sellerAuth.loginDealer({ email: user.email, password: 'wrong-pass-1' }, {}),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: user._id },
      { $set: expect.objectContaining({ failedLoginCount: 1 }) },
    );

    User.findOne.mockReturnValue({ select: async () => null });
    await expect(
      sellerAuth.loginDealer({ email: 'x@y.in', password: PASSWORD }, {}),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('never logs staff accounts into the dealer dashboard', async () => {
    user.staffRole = 'owner';
    await expect(
      sellerAuth.loginDealer({ email: user.email, password: PASSWORD }, {}),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('refuses locked accounts and users outside a dealer team', async () => {
    SellerStaff.exists.mockResolvedValue(null);
    await expect(
      sellerAuth.loginDealer({ email: user.email, password: PASSWORD }, {}),
    ).rejects.toMatchObject({
      code: 'NOT_A_DEALER',
    });

    user.lockUntil = new Date(Date.now() + 60_000);
    await expect(
      sellerAuth.loginDealer({ email: user.email, password: PASSWORD }, {}),
    ).rejects.toMatchObject({
      statusCode: 429,
    });
  });
});

describe('verifyEmailCode', () => {
  it('counts wrong codes and refuses expired ones', async () => {
    const userId = new Types.ObjectId();
    const doc = {
      _id: userId,
      email: 'a@b.in',
      emailVerification: {
        codeHash: 'not-the-hash',
        expiresAt: new Date(Date.now() + 60_000),
        attempts: 0,
      },
    };
    User.findById.mockReturnValue({ select: async () => doc });

    await expect(sellerAuth.verifyEmailCode(userId, '123456')).rejects.toMatchObject({
      code: 'INVALID_EMAIL_CODE',
    });
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: userId },
      { $inc: { 'emailVerification.attempts': 1 } },
    );

    doc.emailVerification.attempts = 5;
    await expect(sellerAuth.verifyEmailCode(userId, '123456')).rejects.toMatchObject({
      code: 'EMAIL_CODE_EXPIRED',
    });
  });
});

describe('team rules', () => {
  const sellerId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    Seller.findById.mockReturnValue(chain({ businessName: 'Shree Motors' }));
    User.findById.mockReturnValue(chain({ name: 'Ravi' }));
    SellerStaff.countDocuments.mockResolvedValue(2);
  });

  it('caps the team size', async () => {
    SellerStaff.countDocuments.mockResolvedValue(20);
    await expect(
      sellerTeam.inviteStaff(sellerId, 'owner', { email: 'a@b.in' }),
    ).rejects.toMatchObject({
      code: 'TEAM_FULL',
    });
  });

  it('does not invite someone who works with another dealer', async () => {
    User.findOne.mockReturnValue(chain({ _id: new Types.ObjectId() }));
    SellerStaff.findOne.mockReturnValue(chain({ sellerId: new Types.ObjectId() }));
    await expect(
      sellerTeam.inviteStaff(sellerId, 'owner', { email: 'a@b.in' }),
    ).rejects.toMatchObject({
      code: 'IN_OTHER_TEAM',
    });
  });

  it('never removes the owner', async () => {
    SellerStaff.findOne.mockResolvedValue({ role: 'owner', save: jest.fn() });
    await expect(sellerTeam.removeMember(sellerId, 'u1')).rejects.toMatchObject({
      code: 'OWNER_REQUIRED',
    });
  });
});
