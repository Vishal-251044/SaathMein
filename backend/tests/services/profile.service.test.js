/**
 * Unit tests for the profile service: profile/city updates (ACC-2), interests (ACC-3)
 * and account deletion (ACC-5). Models and side-effect services are mocked.
 */
jest.mock('../../src/models/user.model', () => ({ findById: jest.fn(), updateOne: jest.fn() }));
jest.mock('../../src/models/session.model', () => ({ updateMany: jest.fn() }));
jest.mock('../../src/models/payment.model', () => ({ exists: jest.fn(async () => null) }));
jest.mock('../../src/models/sellerStaff.model', () => ({ exists: jest.fn(async () => null) }));
jest.mock('../../src/services/city.service', () => ({ getActiveCityAndArea: jest.fn() }));
jest.mock('../../src/services/category.service', () => ({ assertActiveCategories: jest.fn() }));
jest.mock('../../src/services/demandSignal.service', () => ({
  recordInterestSignals: jest.fn(),
  deleteUserSignals: jest.fn(),
}));
jest.mock('../../src/services/upload.service', () => ({ deleteImage: jest.fn() }));

const { Types } = require('mongoose');
const User = require('../../src/models/user.model');
const Session = require('../../src/models/session.model');
const Payment = require('../../src/models/payment.model');
const SellerStaff = require('../../src/models/sellerStaff.model');
const { getActiveCityAndArea } = require('../../src/services/city.service');
const { assertActiveCategories } = require('../../src/services/category.service');
const {
  recordInterestSignals,
  deleteUserSignals,
} = require('../../src/services/demandSignal.service');
const { deleteImage } = require('../../src/services/upload.service');
const profileService = require('../../src/services/profile.service');

/** In-memory user document with a save() spy. */
const makeUser = (overrides = {}) => ({
  _id: new Types.ObjectId(),
  phone: '+919876543210',
  status: 'active',
  language: 'en',
  interests: {},
  save: jest.fn(),
  ...overrides,
});

describe('profile.service', () => {
  it('saves name, language, city and area after validating the city', async () => {
    const user = makeUser();
    const cityId = new Types.ObjectId();
    User.findById.mockResolvedValue(user);
    getActiveCityAndArea.mockResolvedValue({ city: { _id: cityId }, area: { name: 'Kothrud' } });

    const result = await profileService.updateProfile(String(user._id), {
      name: 'Rohan',
      language: 'mr',
      cityId: String(cityId),
      area: 'kothrud',
      pincode: '411038',
    });

    expect(getActiveCityAndArea).toHaveBeenCalledWith(String(cityId), 'kothrud');
    expect(user.save).toHaveBeenCalled();
    expect(result).toMatchObject({
      name: 'Rohan',
      language: 'mr',
      cityId: String(cityId),
      area: 'Kothrud', // canonical name from the city, not the raw input
      pincode: '411038',
    });
  });

  it('refuses to change the area before a city is chosen', async () => {
    User.findById.mockResolvedValue(makeUser());
    await expect(profileService.updateProfile('x', { area: 'Kothrud' })).rejects.toMatchObject({
      code: 'CITY_REQUIRED',
    });
  });

  it('blocks deleted or suspended accounts', async () => {
    User.findById.mockResolvedValue(makeUser({ status: 'deleted' }));
    await expect(profileService.updateProfile('x', { name: 'A B' })).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('saves interests, keeps only brands of chosen categories and completes onboarding', async () => {
    const user = makeUser();
    const bikes = { _id: new Types.ObjectId(), featuredBrands: ['Honda', 'TVS'] };
    User.findById.mockResolvedValue(user);
    assertActiveCategories.mockResolvedValue([bikes]);

    const result = await profileService.saveInterests(String(user._id), {
      categories: [String(bikes._id)],
      brands: ['Honda', 'Apple', 'Honda'],
      budgetMinPaise: 8000000,
      budgetMaxPaise: 15000000,
      timeline: 'this_month',
    });

    expect(result.interests).toMatchObject({
      categories: [String(bikes._id)],
      brands: ['Honda'],
      budgetMinPaise: 8000000,
      budgetMaxPaise: 15000000,
      timeline: 'this_month',
    });
    expect(result.onboardingCompletedAt).toBeInstanceOf(Date);
    expect(recordInterestSignals).toHaveBeenCalledWith(
      expect.objectContaining({ interests: expect.objectContaining({ brands: ['Honda'] }) }),
    );
  });

  it('lets a user skip interests (empty lists) and still completes onboarding', async () => {
    const user = makeUser();
    User.findById.mockResolvedValue(user);
    assertActiveCategories.mockResolvedValue([]);

    const result = await profileService.saveInterests(String(user._id), {
      categories: [],
      brands: [],
    });
    expect(result.onboardingCompletedAt).toBeInstanceOf(Date);
    expect(result.interests.categories).toEqual([]);
  });

  it('deletes an account: erases personal data, ends sessions, removes signals and photo', async () => {
    const user = makeUser({
      firebaseUid: 'fb-1',
      avatar: { url: 'u', publicId: 'saathmein/avatars/x' },
    });
    User.findById.mockResolvedValue(user);

    await profileService.deleteAccount(String(user._id));

    const [, update] = User.updateOne.mock.calls[0];
    expect(update.$set.status).toBe('deleted');
    expect(update.$unset).toMatchObject({
      name: 1,
      phone: 1,
      firebaseUid: 1,
      avatar: 1,
      interests: 1,
    });
    expect(Session.updateMany).toHaveBeenCalledWith(
      { userId: user._id, revokedAt: null },
      { $set: expect.objectContaining({ revokedReason: 'account_deleted' }) },
    );
    expect(deleteUserSignals).toHaveBeenCalledWith(user._id);
    expect(deleteImage).toHaveBeenCalledWith('saathmein/avatars/x');
  });

  it('refuses to delete while a token is held (leave the group or finish the purchase first)', async () => {
    const user = makeUser();
    User.findById.mockResolvedValue(user);
    User.updateOne.mockClear();
    Payment.exists.mockResolvedValueOnce({ _id: 'p1' });
    await expect(profileService.deleteAccount(String(user._id))).rejects.toMatchObject({
      statusCode: 409,
      code: 'ACCOUNT_HAS_ACTIVE_TOKEN',
    });
    expect(User.updateOne).not.toHaveBeenCalled();
    // Only tokens with SaathMein or on hold at a dealer count (a released one = bought)
    const filter = Payment.exists.mock.calls.at(-1)[0];
    expect(filter.$or).toEqual([
      { status: 'paid' },
      { status: 'transferred', 'transfer.status': { $in: ['pending', 'processed'] } },
    ]);
  });

  it('refuses to delete the owner of a dealer business', async () => {
    const user = makeUser();
    User.findById.mockResolvedValue(user);
    SellerStaff.exists.mockResolvedValueOnce({ _id: 's1' });
    await expect(profileService.deleteAccount(String(user._id))).rejects.toMatchObject({
      code: 'ACCOUNT_OWNS_BUSINESS',
    });
  });
});
