/**
 * Upload service — signed direct uploads to Cloudinary (ACC-2 avatars; later product
 * images, KYC documents and invoices).
 *
 * Flow: the API signs exact upload parameters → the app uploads the file straight to
 * Cloudinary → the app sends back Cloudinary's response signature → we verify it, so a
 * client can never attach an image the server did not authorise.
 */
const { getCloudinary } = require('../config/cloudinary');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const { safeEqual } = require('../utils/crypto');
const { createLogger } = require('../utils/logger');

const log = createLogger('UploadService');

const AVATAR_FOLDER = 'saathmein/avatars';
// Resize on upload (incoming transformation): avatars never need more than 512 px
const AVATAR_INCOMING_TRANSFORMATION = 'c_limit,w_512,h_512,q_auto:good';
const AVATAR_FORMATS = 'jpg,jpeg,png,webp,heic';

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
const avatarPublicId = (userId) => `${AVATAR_FOLDER}/${userId}`;

/**
 * Create signed parameters for one avatar upload.
 * @param {string} userId - Owner of the avatar
 * @returns {{ uploadUrl: string, fields: Record<string, string|number> }} POST these fields
 *   (plus `file`) as multipart form data to uploadUrl
 */
const createAvatarUploadParams = (userId) => {
  const cloudinary = requireCloudinary();
  const params = {
    timestamp: Math.round(Date.now() / 1000), // Cloudinary rejects signatures older than 1 hour
    // Full path in public_id (no `folder` param) behaves the same in fixed and dynamic folder modes
    public_id: avatarPublicId(userId),
    overwrite: true,
    invalidate: true,
    allowed_formats: AVATAR_FORMATS,
    transformation: AVATAR_INCOMING_TRANSFORMATION,
  };
  const signature = cloudinary.utils.api_sign_request(params, config.cloudinary.apiSecret);

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudinary.cloudName}/image/upload`,
    fields: { ...params, api_key: config.cloudinary.apiKey, signature },
  };
};

/**
 * Verify the response Cloudinary returned to the app after an avatar upload.
 * @param {string} userId - Expected owner
 * @param {{ publicId: string, version: number, signature: string }} upload - From Cloudinary's response
 * @returns {{ publicId: string, url: string }} Verified asset with a face-cropped 256 px URL
 * @throws {ApiError} 400 INVALID_UPLOAD when the asset is not this user's signed upload
 */
const verifyAvatarUpload = (userId, { publicId, version, signature }) => {
  const cloudinary = requireCloudinary();
  const expectedSignature = cloudinary.utils.api_sign_request(
    { public_id: publicId, version },
    config.cloudinary.apiSecret,
  );

  if (publicId !== avatarPublicId(userId) || !safeEqual(signature, expectedSignature)) {
    log.warn({ userId, publicId }, 'Rejected avatar upload with a bad signature or public id');
    throw ApiError.badRequest('The photo upload could not be verified. Please try again.', {
      code: 'INVALID_UPLOAD',
    });
  }

  const url = cloudinary.url(publicId, {
    version,
    secure: true,
    transformation: [
      { width: 256, height: 256, crop: 'fill', gravity: 'face' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  });
  return { publicId, url };
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

module.exports = { avatarPublicId, createAvatarUploadParams, verifyAvatarUpload, deleteImage };
