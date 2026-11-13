/**
 * Profile service — the logged-in user's own profile (PRD §10.1):
 * profile and city (ACC-2), interests (ACC-3), avatar upload, account deletion (ACC-5).
 */
const User = require('../models/user.model');
const Session = require('../models/session.model');
const Payment = require('../models/payment.model');
const SellerStaff = require('../models/sellerStaff.model');
const ApiError = require('../utils/ApiError');
const { createLogger } = require('../utils/logger');
const { ACCOUNT_STATUS, PAYMENT_STATUS } = require('../constants/enums');
const { getFirebaseAuth } = require('../config/firebase');
const { toAppUser, getUserById } = require('./user.service');
const { getActiveCityAndArea } = require('./city.service');
const { assertActiveCategories } = require('./category.service');
const { recordInterestSignals, deleteUserSignals } = require('./demandSignal.service');
const uploadService = require('./upload.service');

const log = createLogger('ProfileService');

/**
 * Load an active (not deleted/suspended) user.
 * @param {string} userId - User id
 * @returns {Promise<Object>} User document
 * @throws {ApiError} 403 when the account is not active
 */
const getActiveUser = async (userId) => {
  const user = await getUserById(userId);
  if (user.status !== ACCOUNT_STATUS.ACTIVE) {
    throw new ApiError(403, 'This account is not active', { code: 'ACCOUNT_NOT_ACTIVE' });
  }
  return user;
};

/**
 * Update profile fields (ACC-2). City and area are validated against active launch cities;
 * changing city clears the area unless a new one is given.
 * @param {string} userId - User id
 * @param {{ name?: string, language?: string, cityId?: string, area?: string|null,
 *   pincode?: string|null }} changes - Validated by the route
 * @returns {Promise<Object>} Updated app user
 */
const updateProfile = async (userId, changes) => {
  const user = await getActiveUser(userId);

  if (changes.name !== undefined) user.name = changes.name;
  if (changes.language !== undefined) user.language = changes.language;

  if (changes.cityId !== undefined) {
    const { city, area } = await getActiveCityAndArea(changes.cityId, changes.area || undefined);
    user.cityId = city._id;
    user.area = area ? area.name : undefined;
  } else if (changes.area !== undefined) {
    if (!user.cityId) throw new ApiError(422, 'Choose a city first', { code: 'CITY_REQUIRED' });
    const { area } = await getActiveCityAndArea(user.cityId, changes.area || undefined);
    user.area = area ? area.name : undefined;
  }
  if (changes.pincode !== undefined) user.pincode = changes.pincode || undefined;

  await user.save();
  return toAppUser(user);
};

/**
 * Save interest onboarding answers (ACC-3) and record demand signals.
 * Sending empty lists is how a user skips; onboarding is complete either way.
 * @param {string} userId - User id
 * @param {{ categories: string[], brands: string[], budgetMinPaise?: number,
 *   budgetMaxPaise?: number, timeline?: string }} interests - Validated by the route
 * @returns {Promise<Object>} Updated app user
 */
const saveInterests = async (userId, interests) => {
  const user = await getActiveUser(userId);
  const categories = await assertActiveCategories(interests.categories);

  // Only keep brands that belong to the chosen categories
  const allowedBrands = new Set(categories.flatMap((category) => category.featuredBrands || []));
  const brands = [...new Set(interests.brands)].filter((brand) => allowedBrands.has(brand));

  user.interests = {
    categories: categories.map((category) => category._id),
    products: user.interests?.products || [],
    brands,
    budgetMinPaise: interests.budgetMinPaise,
    budgetMaxPaise: interests.budgetMaxPaise,
    timeline: interests.timeline,
  };
  user.onboardingCompletedAt ??= new Date();
  await user.save();

  await recordInterestSignals({ user, categories, interests: { ...interests, brands } });
  return toAppUser(user);
};

/**
 * Signed parameters for uploading a new avatar straight to Cloudinary.
 * @param {string} userId - User id
 * @returns {Promise<Object>} Upload URL and form fields
 */
const getAvatarUploadParams = async (userId) => {
  await getActiveUser(userId);
  return uploadService.createAvatarUploadParams(userId);
};

/**
 * Attach a verified Cloudinary upload as the user's avatar.
 * @param {string} userId - User id
 * @param {{ publicId: string, version: number, signature: string }} upload - Cloudinary response
 * @returns {Promise<Object>} Updated app user
 */
const setAvatar = async (userId, upload) => {
  const user = await getActiveUser(userId);
  const { publicId, url } = uploadService.verifyAvatarUpload(userId, upload);
  user.avatar = { url, publicId };
  await user.save();
  return toAppUser(user);
};

/**
 * Remove the avatar.
 * @param {string} userId - User id
 * @returns {Promise<Object>} Updated app user
 */
const removeAvatar = async (userId) => {
  const user = await getActiveUser(userId);
  const publicId = user.avatar?.publicId;
  user.avatar = undefined;
  await user.save();
  await uploadService.deleteImage(publicId);
  return toAppUser(user);
};

/**
 * Delete the account (ACC-5). Personal data is erased; the user record stays as an
 * anonymous "deleted" stub so payments and ledger history (required for accounting)
 * still point to something. The phone number becomes free to register again.
 * Refused while money is still in play: a token with SaathMein (seat in a group) or held at
 * a dealer for an open purchase — the person leaves the group (refund) or completes the
 * purchase first. Owners of a dealer business close or hand over the business first.
 * @param {string} userId - User id
 * @returns {Promise<void>}
 * @throws {ApiError} 409 ACCOUNT_HAS_ACTIVE_TOKEN / ACCOUNT_OWNS_BUSINESS
 */
const deleteAccount = async (userId) => {
  const user = await getActiveUser(userId);
  const [activeToken, ownsBusiness] = await Promise.all([
    Payment.exists({
      userId: user._id,
      $or: [
        { status: PAYMENT_STATUS.PAID },
        // On hold at the dealer (purchase not finished yet); released = bought, fine
        {
          status: PAYMENT_STATUS.TRANSFERRED,
          'transfer.status': { $in: ['pending', 'processed'] },
        },
      ],
    }),
    SellerStaff.exists({ userId: user._id, role: 'owner', status: 'active' }),
  ]);
  if (activeToken) {
    throw ApiError.conflict(
      'You still have a token in a group. Leave the group (your token is refunded) or finish the purchase, then delete your account.',
      { code: 'ACCOUNT_HAS_ACTIVE_TOKEN' },
    );
  }
  if (ownsBusiness) {
    throw ApiError.conflict(
      'You own a dealer business on SaathMein. Contact support to close it first.',
      {
        code: 'ACCOUNT_OWNS_BUSINESS',
      },
    );
  }

  const { firebaseUid } = user;
  const avatarPublicId = user.avatar?.publicId;

  await User.updateOne(
    { _id: user._id },
    {
      $set: { status: ACCOUNT_STATUS.DELETED, deletedAt: new Date(), deviceIds: [] },
      $unset: {
        name: 1,
        phone: 1,
        email: 1,
        firebaseUid: 1,
        avatar: 1,
        cityId: 1,
        area: 1,
        pincode: 1,
        interests: 1,
        onboardingCompletedAt: 1,
      },
    },
  );
  await Session.updateMany(
    { userId: user._id, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: 'account_deleted' } },
  );
  await deleteUserSignals(user._id);
  await uploadService.deleteImage(avatarPublicId);

  // Remove the Firebase phone identity too (best effort)
  const firebaseAuth = getFirebaseAuth();
  if (firebaseAuth && firebaseUid) {
    await firebaseAuth.deleteUser(firebaseUid).catch((err) => {
      log.error({ err: err.message, userId }, 'Firebase user delete failed');
    });
  }

  log.info({ userId }, 'Account deleted');
};

module.exports = {
  getActiveUser,
  updateProfile,
  saveInterests,
  getAvatarUploadParams,
  setAvatar,
  removeAvatar,
  deleteAccount,
};
