/**
 * Cloudinary client (images CDN). Configured lazily from CLOUDINARY_* in backend/.env.
 * Uploads are always SIGNED by the server, so clients can only upload exactly what the
 * server allowed (folder, public id, formats, size limit).
 */
const { v2: cloudinary } = require('cloudinary');
const config = require('./env');

let isInitialised = false;

/**
 * Get the configured Cloudinary SDK.
 * @returns {typeof import('cloudinary').v2|null} SDK, or null when not configured
 */
const getCloudinary = () => {
  if (!config.cloudinary.isConfigured) return null;
  if (!isInitialised) {
    cloudinary.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
      secure: true,
    });
    isInitialised = true;
  }
  return cloudinary;
};

module.exports = { getCloudinary };
