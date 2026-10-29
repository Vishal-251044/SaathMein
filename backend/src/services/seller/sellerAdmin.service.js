/**
 * Admin seller management (TRU-1, PRD §10.11 Sellers): KYC queue, seller detail with
 * private document previews, approve / reject with reason, and retrying payout setup.
 * Approval needs a Razorpay linked account, because winning tokens are paid out there.
 */
const Seller = require('../../models/seller.model');
const SellerStaff = require('../../models/sellerStaff.model');
const User = require('../../models/user.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { getPagination, buildPaginationMeta } = require('../../helpers/genericFunctions');
const { KYC_STATUS } = require('../../constants/enums');
const uploadService = require('../upload.service');
const emailService = require('../email.service');
const { setupLinkedAccount } = require('./routeAccount.service');
const { toAdminSeller } = require('./sellerPresenter');

const log = createLogger('SellerAdmin');

/** Escape text for a RegExp. */
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Sellers for the admin list. Pending KYC is oldest-first (a review queue).
 * @param {{ kycStatus?: string, q?: string, page?: string, limit?: string }} query
 * @returns {Promise<{ sellers: Object[], meta: Object }>}
 */
const listSellers = async ({ kycStatus, q, page, limit }) => {
  const pagination = getPagination({ page, limit });
  const filter = {};
  if (kycStatus) filter['kyc.status'] = kycStatus;
  if (q?.trim()) {
    const pattern = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ businessName: pattern }, { gstin: pattern }, { contactEmail: pattern }];
  }
  const sort = kycStatus === KYC_STATUS.PENDING ? { 'kyc.submittedAt': 1 } : { updatedAt: -1 };

  const [sellers, total] = await Promise.all([
    Seller.find(filter).sort(sort).skip(pagination.skip).limit(pagination.limit).lean(),
    Seller.countDocuments(filter),
  ]);
  return {
    sellers: sellers.map((seller) => toAdminSeller(seller)),
    meta: buildPaginationMeta(total, pagination),
  };
};

/**
 * Load a seller or throw.
 * @param {string} sellerId - Seller id
 * @returns {Promise<Object>} Seller document
 */
const findSellerOrThrow = async (sellerId) => {
  const seller = await Seller.findById(sellerId);
  if (!seller) throw ApiError.notFound(`Seller not found with id: ${sellerId}`);
  return seller;
};

/**
 * Seller detail for review: owner, team and short-lived document links.
 * @param {string} sellerId - Seller id
 * @returns {Promise<Object>} Admin seller
 */
const getSellerDetail = async (sellerId) => {
  const seller = await findSellerOrThrow(sellerId);
  const [owner, staff] = await Promise.all([
    User.findById(seller.ownerUserId).select('name email emailVerifiedAt').lean(),
    SellerStaff.find({ sellerId, status: 'active' }).populate('userId', 'name email').lean(),
  ]);
  const documents = seller.kyc.docs.map((doc) => ({
    id: String(doc._id),
    type: doc.type,
    format: doc.format || null,
    uploadedAt: doc.uploadedAt,
    previewUrl: uploadService.kycDocumentUrl(doc), // expires in 10 minutes
  }));
  const team = staff
    .filter((member) => member.userId)
    .map((member) => ({
      userId: String(member.userId._id),
      name: member.userId.name || null,
      email: member.userId.email,
      role: member.role,
    }));
  return toAdminSeller(seller, { owner, documents, team });
};

/**
 * Approve a seller's KYC.
 * @param {string} sellerId - Seller id
 * @param {string} staffUserId - Reviewer
 * @returns {Promise<{ seller: Object, before: Object }>} After/before snapshots for the audit log
 * @throws {ApiError} 409 when not pending or payouts are not set up
 */
const approveKyc = async (sellerId, staffUserId) => {
  const seller = await findSellerOrThrow(sellerId);
  const before = {
    kycStatus: seller.kyc.status,
    rejectionReason: seller.kyc.rejectionReason || null,
  };
  if (seller.kyc.status !== KYC_STATUS.PENDING) {
    throw ApiError.conflict('Only KYC waiting for review can be approved', {
      code: 'KYC_NOT_PENDING',
    });
  }
  if (!seller.razorpayAccountId || ['not_started', 'failed'].includes(seller.razorpay?.status)) {
    throw ApiError.conflict('Set up the Razorpay payout account first (Retry payout setup)', {
      code: 'PAYOUT_ACCOUNT_REQUIRED',
    });
  }
  if (!seller.razorpay?.settlementsConfigured) {
    throw ApiError.conflict(
      'Razorpay has no payout bank account for this dealer. Send the KYC back so they re-enter it.',
      {
        code: 'PAYOUT_BANK_REQUIRED',
      },
    );
  }

  seller.kyc.status = KYC_STATUS.APPROVED;
  seller.kyc.reviewedBy = staffUserId;
  seller.kyc.reviewedAt = new Date();
  seller.kyc.rejectionReason = undefined;
  await seller.save();

  const owner = await User.findById(seller.ownerUserId).select('email').lean();
  if (owner?.email)
    await emailService.sendKycApproved({ to: owner.email, businessName: seller.businessName });
  log.info({ sellerId, staffUserId }, 'KYC approved');
  return { seller: await getSellerDetail(sellerId), before };
};

/**
 * Reject (send back) a seller's KYC with a reason the dealer sees.
 * @param {string} sellerId - Seller id
 * @param {string} staffUserId - Reviewer
 * @param {string} reason - What the dealer must fix
 * @returns {Promise<{ seller: Object, before: Object }>}
 */
const rejectKyc = async (sellerId, staffUserId, reason) => {
  const seller = await findSellerOrThrow(sellerId);
  const before = { kycStatus: seller.kyc.status };
  if (seller.kyc.status !== KYC_STATUS.PENDING) {
    throw ApiError.conflict('Only KYC waiting for review can be sent back', {
      code: 'KYC_NOT_PENDING',
    });
  }

  seller.kyc.status = KYC_STATUS.REJECTED;
  seller.kyc.reviewedBy = staffUserId;
  seller.kyc.reviewedAt = new Date();
  seller.kyc.rejectionReason = reason;
  await seller.save();

  const owner = await User.findById(seller.ownerUserId).select('email').lean();
  if (owner?.email)
    await emailService.sendKycRejected({
      to: owner.email,
      businessName: seller.businessName,
      reason,
    });
  log.info({ sellerId, staffUserId }, 'KYC rejected');
  return { seller: await getSellerDetail(sellerId), before };
};

/**
 * Retry the Razorpay linked-account steps that do not need bank details. If the bank step
 * failed, the dealer must resubmit KYC (we never store full bank details).
 * @param {string} sellerId - Seller id
 * @returns {Promise<Object>} Admin seller
 */
const retryPayoutSetup = async (sellerId) => {
  const seller = await findSellerOrThrow(sellerId);
  if (seller.kyc.status === KYC_STATUS.NOT_SUBMITTED) {
    throw new ApiError(422, 'The dealer has not submitted KYC yet', { code: 'KYC_NOT_SUBMITTED' });
  }
  await setupLinkedAccount(seller, null);
  return getSellerDetail(sellerId);
};

module.exports = { listSellers, getSellerDetail, approveKyc, rejectKyc, retryPayoutSetup };
