/**
 * Dealer account (PRD §10.10 Profile, TRU-1 KYC):
 * business profile, coverage (cities + categories, AUC-1 eligibility), shop location,
 * KYC documents (private uploads) and KYC submission, which also sets up the Razorpay
 * Route linked account. Staff review it in the admin console.
 */
const Seller = require('../../models/seller.model');
const User = require('../../models/user.model');
const City = require('../../models/city.model');
const Category = require('../../models/category.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { KYC_STATUS, STAFF_ROLE } = require('../../constants/enums');
const uploadService = require('../upload.service');
const emailService = require('../email.service');
const { setupLinkedAccount } = require('./routeAccount.service');
const { toSellerSelf } = require('./sellerPresenter');
const config = require('../../config/env');

const log = createLogger('SellerAccount');

/** Category slugs whose dealers must prove they are authorised dealers (TRU-1). */
const VEHICLE_CATEGORY_SLUGS = ['cars-evs', 'two-wheelers'];

/**
 * Load the seller and owner for the dashboard.
 * @param {string} sellerId - Seller id
 * @returns {Promise<{ seller: Object, owner: Object }>}
 */
const loadSellerWithOwner = async (sellerId) => {
  const seller = await Seller.findById(sellerId);
  if (!seller) throw ApiError.notFound('Dealer account not found');
  const owner = await User.findById(seller.ownerUserId).select('name email emailVerifiedAt');
  return { seller, owner };
};

/**
 * Dealer dashboard data: the seller, the user's role and the onboarding checklist.
 * @param {{ sellerId: string, role: string }} membership - From requireSeller
 * @returns {Promise<Object>}
 */
const getMyDealer = async ({ sellerId, role }) => {
  const { seller, owner } = await loadSellerWithOwner(sellerId);
  return toSellerSelf(seller, { owner, role });
};

/**
 * Check coverage ids: active cities and active leaf categories only.
 * @param {{ cities?: string[], categories?: string[] }} input
 * @returns {Promise<void>}
 * @throws {ApiError} 422
 */
const assertCoverage = async ({ cities, categories }) => {
  if (cities) {
    const found = await City.countDocuments({ _id: { $in: cities }, active: true });
    if (found !== new Set(cities).size)
      throw new ApiError(422, 'Pick cities from the list', { code: 'INVALID_CITY' });
  }
  if (categories) {
    const unique = [...new Set(categories)];
    const [found, parents] = await Promise.all([
      Category.countDocuments({ _id: { $in: unique }, active: true }),
      Category.countDocuments({ parentId: { $in: unique } }),
    ]);
    if (found !== unique.length || parents > 0) {
      throw new ApiError(422, 'Pick categories from the list', { code: 'INVALID_CATEGORY' });
    }
  }
};

/**
 * Update the dealer profile (owner only). Business identity fields lock while KYC is
 * under review or approved; changing them later needs a new KYC review.
 * @param {string} sellerId - Seller id
 * @param {Object} changes - Validated fields
 * @returns {Promise<Object>} Updated seller (self view)
 */
const updateDealerProfile = async (sellerId, changes) => {
  const { seller, owner } = await loadSellerWithOwner(sellerId);
  await assertCoverage(changes);

  const isLocked = [KYC_STATUS.PENDING, KYC_STATUS.APPROVED].includes(seller.kyc.status);
  if (isLocked && changes.businessName && changes.businessName !== seller.businessName) {
    throw new ApiError(
      409,
      'The business name is verified. Contact SaathMein support to change it.',
      {
        code: 'KYC_LOCKED',
      },
    );
  }

  ['businessName', 'contactName', 'contactPhone', 'cities', 'categories'].forEach((key) => {
    if (changes[key] !== undefined) seller[key] = changes[key];
  });
  if (changes.location) seller.geo = { type: 'Point', coordinates: changes.location };
  await seller.save();
  return toSellerSelf(seller, { owner, role: 'owner' });
};

/**
 * Signed params for uploading one private KYC document.
 * @param {string} sellerId - Seller id
 * @param {string} docType - Document type
 * @returns {Promise<Object>}
 */
const getKycUploadParams = async (sellerId, docType) => {
  const { seller } = await loadSellerWithOwner(sellerId);
  if (seller.kyc.status === KYC_STATUS.PENDING) {
    throw new ApiError(409, 'Your KYC is under review. You can change it if it is sent back.', {
      code: 'KYC_LOCKED',
    });
  }
  return uploadService.createKycUploadParams(sellerId, docType);
};

/**
 * GSTIN characters 3–12 are the business PAN — they must match.
 * @param {string} gstin - GSTIN
 * @param {string} pan - PAN
 * @returns {boolean}
 */
const gstinMatchesPan = (gstin, pan) => gstin.slice(2, 12) === pan;

/**
 * Notify reviewers (Owner, Admin, Deal Managers) that a KYC is waiting.
 * @param {Object} seller - Seller
 * @returns {Promise<void>}
 */
const notifyReviewers = async (seller) => {
  const reviewers = await User.find({
    staffRole: { $in: [STAFF_ROLE.OWNER, STAFF_ROLE.ADMIN, STAFF_ROLE.DEAL_MANAGER] },
    status: 'active',
  })
    .select('email')
    .lean();
  const emails = reviewers.map((reviewer) => reviewer.email).filter(Boolean);
  if (!emails.length) return;
  const adminUrl = `${config.sellerWebUrl.replace(/\/seller$/, '')}/admin/sellers/${seller._id}`;
  await emailService.sendKycReviewNeeded({
    to: emails,
    businessName: seller.businessName,
    adminUrl,
  });
};

/**
 * Submit KYC (TRU-1): business identity, address, documents and payout bank.
 * Sets up the Razorpay Route linked account, then waits for staff review.
 * @param {string} sellerId - Seller id
 * @param {string} userId - Owner submitting
 * @param {Object} input - Validated KYC form
 * @returns {Promise<Object>} Seller (self view) incl. payout setup status
 */
const submitKyc = async (sellerId, userId, input) => {
  const { seller, owner } = await loadSellerWithOwner(sellerId);

  if (!owner?.emailVerifiedAt) {
    throw new ApiError(422, 'Verify your email before submitting KYC', {
      code: 'EMAIL_NOT_VERIFIED',
    });
  }
  if (seller.kyc.status === KYC_STATUS.PENDING) {
    throw new ApiError(409, 'Your KYC is already under review', { code: 'KYC_LOCKED' });
  }
  if (seller.kyc.status === KYC_STATUS.APPROVED) {
    throw new ApiError(409, 'Your KYC is already approved. Contact support to change it.', {
      code: 'KYC_LOCKED',
    });
  }
  if (!seller.cities.length || !seller.categories.length) {
    throw new ApiError(422, 'Choose the cities and categories you sell in first', {
      code: 'COVERAGE_REQUIRED',
    });
  }
  if (!gstinMatchesPan(input.gstin, input.pan)) {
    throw new ApiError(422, 'The PAN does not match the GSTIN', { code: 'PAN_GSTIN_MISMATCH' });
  }

  const city = await City.findOne({ _id: input.address.cityId, active: true }).lean();
  if (!city) throw new ApiError(422, 'Pick the shop city from the list', { code: 'INVALID_CITY' });

  input.documents.forEach((doc) => uploadService.verifyKycUpload(sellerId, doc));
  const docTypes = new Set(input.documents.map((doc) => doc.type));
  const vehicleCategories = await Category.countDocuments({
    _id: { $in: seller.categories },
    slug: { $in: VEHICLE_CATEGORY_SLUGS },
  });
  const required = [
    'gst_certificate',
    'pan_card',
    'shop_photo',
    ...(vehicleCategories ? ['dealer_proof'] : []),
  ];
  const missing = required.filter((type) => !docTypes.has(type));
  if (missing.length) {
    throw new ApiError(422, `Upload these documents: ${missing.join(', ')}`, {
      code: 'KYC_DOCUMENTS_MISSING',
      details: { missing },
    });
  }

  Object.assign(seller, {
    businessName: input.businessName,
    businessType: input.businessType,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    gstin: input.gstin,
    pan: input.pan,
    address: { ...input.address, state: input.address.state || city.state },
    bank: {
      accountLast4: input.bank.accountNumber.slice(-4),
      ifsc: input.bank.ifsc,
      beneficiaryName: input.bank.beneficiaryName,
    },
  });
  seller.kyc.docs = input.documents.map((doc) => ({
    type: doc.type,
    publicId: doc.publicId,
    format: doc.format,
    version: doc.version,
  }));
  seller.kyc.status = KYC_STATUS.PENDING;
  seller.kyc.submittedAt = new Date();
  seller.kyc.rejectionReason = undefined;

  try {
    await seller.save();
  } catch (err) {
    if (err?.code === 11000) {
      throw ApiError.conflict('This GSTIN is already registered with another dealer', {
        code: 'GSTIN_TAKEN',
      });
    }
    throw err;
  }

  // Bank details go to Razorpay only, never to our database
  await setupLinkedAccount(seller, input.bank);
  await Promise.allSettled([
    emailService.sendKycSubmitted({ to: owner.email, businessName: seller.businessName }),
    notifyReviewers(seller),
  ]);
  log.info({ sellerId, userId, payouts: seller.razorpay?.status }, 'KYC submitted');
  return toSellerSelf(seller, { owner, role: 'owner' });
};

module.exports = {
  VEHICLE_CATEGORY_SLUGS,
  getMyDealer,
  updateDealerProfile,
  getKycUploadParams,
  gstinMatchesPan,
  submitKyc,
};
