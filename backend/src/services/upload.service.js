/**
 * Upload service — signed direct uploads to Cloudinary (avatars, product images; later KYC
 * documents and invoices).
 *
 * Flow: the API signs exact upload parameters (including the public id) → the client
 * uploads the file straight to Cloudinary → the client sends back Cloudinary's response
 * signature → we verify it, so nobody can attach an image the server did not authorise.
 */
const { getCloudinary } = require('../config/cloudinary');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const { randomToken, safeEqual } = require('../utils/crypto');
const { createLogger } = require('../utils/logger');

const log = createLogger('UploadService');

const IMAGE_FORMATS = 'jpg,jpeg,png,webp,heic';

/** Upload kinds: where files go and how they are resized on upload. */
const UPLOAD_KINDS = {
  avatar: { folder: 'saathmein/avatars', transformation: 'c_limit,w_512,h_512,q_auto:good' },
  product: { folder: 'saathmein/products', transformation: 'c_limit,w_1600,h_1600,q_auto:good' },
  chat: { folder: 'saathmein/chat', transformation: 'c_limit,w_1280,h_1280,q_auto:good' },
};

/**
 * Get Cloudinary or fail with a clear 503.
 * @returns {typeof import('cloudinary').v2}
 * @throws {ApiError} 503 UPLOADS_NOT_CONFIGURED
 */
const requireCloudinary = () => {
  const cloudinary = getCloudinary();
  if (!cloudinary) {
    throw new ApiError(503, 'Photo upload is not available right now.', {
      code: 'UPLOADS_NOT_CONFIGURED',
    });
  }
  return cloudinary;
};

/** @param {string} userId @returns {string} The only public id a user may upload an avatar to */
const avatarPublicId = (userId) => `${UPLOAD_KINDS.avatar.folder}/${userId}`;

/** @param {string} productId @returns {string} Folder (public id prefix) for one product's images */
const productImagePrefix = (productId) => `${UPLOAD_KINDS.product.folder}/${productId}/`;

/**
 * Sign upload parameters for one file at an exact public id.
 * @param {string} publicId - Full Cloudinary public id (folder path included)
 * @param {'avatar'|'product'} kind - Upload kind (resize rules)
 * @returns {{ uploadUrl: string, fields: Record<string, string|number|boolean> }} POST these fields
 *   plus `file` as multipart form data to uploadUrl
 */
const createSignedUpload = (publicId, kind) => {
  const cloudinary = requireCloudinary();
  const params = {
    timestamp: Math.round(Date.now() / 1000), // Cloudinary rejects signatures older than 1 hour
    // Full path in public_id (no `folder` param) behaves the same in fixed and dynamic folder modes
    public_id: publicId,
    overwrite: true,
    invalidate: true,
    allowed_formats: IMAGE_FORMATS,
    transformation: UPLOAD_KINDS[kind].transformation,
  };
  const signature = cloudinary.utils.api_sign_request(params, config.cloudinary.apiSecret);

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudinary.cloudName}/image/upload`,
    fields: { ...params, api_key: config.cloudinary.apiKey, signature },
  };
};

/**
 * Check the signature Cloudinary returned after an upload.
 * @param {{ publicId: string, version: number, signature: string }} upload - From Cloudinary's response
 * @param {(publicId: string) => boolean} isAllowedPublicId - Ownership check
 * @returns {void}
 * @throws {ApiError} 400 INVALID_UPLOAD
 */
const assertValidUpload = ({ publicId, version, signature }, isAllowedPublicId) => {
  const cloudinary = requireCloudinary();
  const expected = cloudinary.utils.api_sign_request(
    { public_id: publicId, version },
    config.cloudinary.apiSecret,
  );
  if (!isAllowedPublicId(publicId) || !safeEqual(signature, expected)) {
    log.warn({ publicId }, 'Rejected upload with a bad signature or public id');
    throw ApiError.badRequest('The photo upload could not be verified. Please try again.', {
      code: 'INVALID_UPLOAD',
    });
  }
};

/**
 * Delivery URL for a stored image.
 * @param {string} publicId - Cloudinary public id
 * @param {number} version - Asset version
 * @param {Object[]} [transformation] - Extra transformations
 * @returns {string} HTTPS URL
 */
const imageUrl = (publicId, version, transformation = []) =>
  requireCloudinary().url(publicId, {
    version,
    secure: true,
    transformation: [...transformation, { quality: 'auto', fetch_format: 'auto' }],
  });

/* --------------------------------- Avatars --------------------------------- */

/** @param {string} userId @returns Signed params for the user's avatar */
const createAvatarUploadParams = (userId) => createSignedUpload(avatarPublicId(userId), 'avatar');

/**
 * Verify an avatar upload.
 * @param {string} userId - Expected owner
 * @param {{ publicId: string, version: number, signature: string }} upload - Cloudinary response
 * @returns {{ publicId: string, url: string }} Verified asset with a face-cropped 256 px URL
 */
const verifyAvatarUpload = (userId, upload) => {
  assertValidUpload(upload, (publicId) => publicId === avatarPublicId(userId));
  return {
    publicId: upload.publicId,
    url: imageUrl(upload.publicId, upload.version, [
      { width: 256, height: 256, crop: 'fill', gravity: 'face' },
    ]),
  };
};

/* ----------------------------- Product images ----------------------------- */

/** @param {string} productId @returns Signed params for one new product image */
const createProductImageUploadParams = (productId) =>
  createSignedUpload(`${productImagePrefix(productId)}${randomToken(9)}`, 'product');

/**
 * Verify a product image upload.
 * @param {string} productId - Product the image must belong to
 * @param {{ publicId: string, version: number, signature: string }} upload - Cloudinary response
 * @returns {{ publicId: string, url: string }} Verified image (apps add size transforms)
 */
const verifyProductImageUpload = (productId, upload) => {
  assertValidUpload(upload, (publicId) => publicId.startsWith(productImagePrefix(productId)));
  return { publicId: upload.publicId, url: imageUrl(upload.publicId, upload.version) };
};

/* ------------------------------- Chat images ------------------------------- */

/** @param {string} groupId @returns {string} Public id prefix for one group's chat images */
const chatImagePrefix = (groupId) => `${UPLOAD_KINDS.chat.folder}/${groupId}/`;

/** @param {string} groupId @returns Signed params for one chat image (LIV-5) */
const createChatImageUploadParams = (groupId) =>
  createSignedUpload(`${chatImagePrefix(groupId)}${randomToken(9)}`, 'chat');

/**
 * Verify a chat image upload belongs to this group and was signed by us.
 * @param {string} groupId - Group chat
 * @param {{ publicId: string, version: number, signature: string }} upload - Cloudinary response
 * @returns {{ publicId: string, url: string }}
 */
const verifyChatImageUpload = (groupId, upload) => {
  assertValidUpload(upload, (publicId) => publicId.startsWith(chatImagePrefix(groupId)));
  return { publicId: upload.publicId, url: imageUrl(upload.publicId, upload.version) };
};

/* ------------------------------ KYC documents ------------------------------ */

const KYC_FOLDER = 'saathmein/kyc';
const KYC_FORMATS = 'jpg,jpeg,png,pdf';
const KYC_PREVIEW_TTL_SECONDS = 10 * 60;

/** @param {string} sellerId @returns {string} Public id prefix for a seller's KYC files */
const kycPrefix = (sellerId) => `${KYC_FOLDER}/${sellerId}/`;

/**
 * Signed params for one PRIVATE KYC document (TRU-1). `type: authenticated` means the
 * file can only be opened with a signed, expiring URL — never a public link.
 * @param {string} sellerId - Seller the document belongs to
 * @param {string} docType - e.g. gst_certificate, pan_card, shop_photo
 * @returns {{ uploadUrl: string, fields: Object }}
 */
const createKycUploadParams = (sellerId, docType) => {
  const cloudinary = requireCloudinary();
  const params = {
    timestamp: Math.round(Date.now() / 1000),
    public_id: `${kycPrefix(sellerId)}${docType}-${randomToken(9)}`,
    type: 'authenticated',
    allowed_formats: KYC_FORMATS,
  };
  const signature = cloudinary.utils.api_sign_request(params, config.cloudinary.apiSecret);
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudinary.cloudName}/image/upload`,
    fields: { ...params, api_key: config.cloudinary.apiKey, signature },
  };
};

/**
 * Verify a KYC upload belongs to this seller and was signed by us.
 * @param {string} sellerId - Seller id
 * @param {{ publicId: string, version: number, signature: string }} upload - Cloudinary response
 */
const verifyKycUpload = (sellerId, upload) => {
  assertValidUpload(upload, (publicId) => publicId.startsWith(kycPrefix(sellerId)));
};

/**
 * Short-lived link to view a private file: KYC document or purchase invoice (10 minutes).
 * @param {{ publicId: string, format?: string }} doc - Stored document
 * @returns {string|null} Signed URL, or null when Cloudinary is not configured
 */
const privateFileUrl = ({ publicId, format }) => {
  const cloudinary = getCloudinary();
  if (!cloudinary) return null;
  return cloudinary.utils.private_download_url(publicId, format || 'jpg', {
    type: 'authenticated',
    resource_type: 'image',
    expires_at: Math.round(Date.now() / 1000) + KYC_PREVIEW_TTL_SECONDS,
  });
};

/* ---------------------------- Purchase invoices ---------------------------- */

const INVOICE_FOLDER = 'saathmein/invoices';

/** @param {string} purchaseId @returns {string} Public id prefix for one purchase's invoice */
const invoicePrefix = (purchaseId) => `${INVOICE_FOLDER}/${purchaseId}/`;

/**
 * Signed params for the buyer's PRIVATE invoice photo or PDF (PUR-2). Like KYC files, it
 * opens only through a short-lived signed URL.
 * @param {string} purchaseId - Purchase
 * @returns {{ uploadUrl: string, fields: Object }}
 */
const createInvoiceUploadParams = (purchaseId) => {
  const cloudinary = requireCloudinary();
  const params = {
    timestamp: Math.round(Date.now() / 1000),
    public_id: `${invoicePrefix(purchaseId)}${randomToken(9)}`,
    type: 'authenticated',
    allowed_formats: KYC_FORMATS,
  };
  const signature = cloudinary.utils.api_sign_request(params, config.cloudinary.apiSecret);
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudinary.cloudName}/image/upload`,
    fields: { ...params, api_key: config.cloudinary.apiKey, signature },
  };
};

/**
 * Verify an invoice upload belongs to this purchase and was signed by us.
 * @param {string} purchaseId - Purchase
 * @param {{ publicId: string, version: number, signature: string }} upload - Cloudinary response
 */
const verifyInvoiceUpload = (purchaseId, upload) => {
  assertValidUpload(upload, (publicId) => publicId.startsWith(invoicePrefix(purchaseId)));
};

/**
 * Delete an image (best effort — a failed delete must never block the user).
 * @param {string} publicId - Cloudinary public id
 * @returns {Promise<void>}
 */
const deleteImage = async (publicId) => {
  const cloudinary = getCloudinary();
  if (!cloudinary || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
  } catch (err) {
    log.error({ err: err.message, publicId }, 'Cloudinary delete failed');
  }
};

module.exports = {
  avatarPublicId,
  productImagePrefix,
  createAvatarUploadParams,
  verifyAvatarUpload,
  createProductImageUploadParams,
  verifyProductImageUpload,
  createChatImageUploadParams,
  verifyChatImageUpload,
  createKycUploadParams,
  verifyKycUpload,
  kycDocumentUrl: privateFileUrl,
  privateFileUrl,
  createInvoiceUploadParams,
  verifyInvoiceUpload,
  deleteImage,
};
