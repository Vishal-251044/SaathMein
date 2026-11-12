/**
 * Seller presenters — the shapes a seller takes in API responses.
 * Public: what buyers may see (no documents, bank or contact details before acceptance).
 * Self: what the dealer team sees. Admin: everything staff need for KYC review.
 */
const { KYC_STATUS } = require('../../constants/enums');

/** @param {*} id @returns {string|null} */
const str = (id) => (id ? String(id) : null);

/**
 * What a dealer must still do before going live (dashboard checklist).
 * @param {Object} seller - Seller document
 * @param {Object} owner - Owner user (emailVerifiedAt)
 * @returns {{ emailVerified: boolean, profileComplete: boolean, kycSubmitted: boolean, approved: boolean }}
 */
const onboardingChecklist = (seller, owner) => ({
  emailVerified: Boolean(owner?.emailVerifiedAt),
  profileComplete: Boolean(
    seller.cities?.length && seller.categories?.length && seller.contactPhone,
  ),
  kycSubmitted: [KYC_STATUS.PENDING, KYC_STATUS.APPROVED].includes(seller.kyc?.status),
  approved: seller.kyc?.status === KYC_STATUS.APPROVED,
});

/**
 * Seller for its own team (dealer dashboard).
 * @param {Object} seller - Seller document
 * @param {{ owner?: Object, role?: string }} [context]
 * @returns {Object}
 */
const toSellerSelf = (seller, { owner, role } = {}) => ({
  id: str(seller._id),
  businessName: seller.businessName,
  businessType: seller.businessType || null,
  contactName: seller.contactName || null,
  contactPhone: seller.contactPhone || null,
  contactEmail: seller.contactEmail || null,
  gstin: seller.gstin || null,
  pan: seller.pan || null,
  address: seller.address ? { ...seller.address, cityId: str(seller.address.cityId) } : null,
  location: seller.geo?.coordinates || null,
  cities: (seller.cities || []).map(String),
  categories: (seller.categories || []).map(String),
  kyc: {
    status: seller.kyc?.status,
    submittedAt: seller.kyc?.submittedAt || null,
    reviewedAt: seller.kyc?.reviewedAt || null,
    rejectionReason: seller.kyc?.rejectionReason || null,
    documents: (seller.kyc?.docs || []).map((doc) => ({
      id: str(doc._id),
      type: doc.type,
      uploadedAt: doc.uploadedAt,
    })),
  },
  bank: seller.bank?.accountLast4
    ? {
        accountLast4: seller.bank.accountLast4,
        ifsc: seller.bank.ifsc,
        beneficiaryName: seller.bank.beneficiaryName,
      }
    : null,
  payouts: { status: seller.razorpay?.status || 'not_started' },
  rating: seller.rating,
  ratingCount: seller.ratingCount,
  status: seller.status,
  role: role || null,
  checklist: onboardingChecklist(seller, owner),
});

/**
 * Seller as buyers see it (seller profile card, offers).
 * @param {Object} seller - Seller document (lean)
 * @param {{ distanceKm?: number|null }} [extra]
 * @returns {Object}
 */
const toPublicSeller = (seller, { distanceKm = null } = {}) => ({
  id: str(seller._id),
  businessName: seller.businessName,
  area: seller.address?.area || null,
  cityId: str(seller.address?.cityId),
  // Rating includes rating penalties (each a 1-star); the count shown is published reviews
  rating: seller.ratingCount ? seller.rating : null,
  ratingCount: seller.reviewCount ?? seller.ratingCount ?? 0,
  verified: seller.kyc?.status === KYC_STATUS.APPROVED,
  distanceKm,
});

/**
 * Seller for admin review (KYC queue and detail).
 * @param {Object} seller - Seller document (lean or doc)
 * @param {{ owner?: Object, documents?: Object[], team?: Object[] }} [extra]
 * @returns {Object}
 */
const toAdminSeller = (seller, { owner, documents, team } = {}) => ({
  ...toSellerSelf(seller, { owner }),
  owner: owner
    ? {
        id: str(owner._id),
        name: owner.name || null,
        email: owner.email || null,
        emailVerified: Boolean(owner.emailVerifiedAt),
      }
    : null,
  razorpay: {
    accountId: seller.razorpayAccountId || null,
    status: seller.razorpay?.status || 'not_started',
    lastError: seller.razorpay?.lastError || null,
    settlementsConfigured: Boolean(seller.razorpay?.settlementsConfigured),
    updatedAt: seller.razorpay?.updatedAt || null,
  },
  kyc: {
    ...toSellerSelf(seller).kyc,
    reviewedBy: str(seller.kyc?.reviewedBy),
    documents: documents || toSellerSelf(seller).kyc.documents,
  },
  team: team || [],
  createdAt: seller.createdAt,
});

module.exports = { onboardingChecklist, toSellerSelf, toPublicSeller, toAdminSeller };
