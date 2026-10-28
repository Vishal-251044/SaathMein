/**
 * Small crypto helpers built on Node's crypto module:
 * random tokens, keyed hashing, constant-time comparison and AES-256-GCM encryption.
 * Never log the inputs or outputs of these functions.
 */
const crypto = require('crypto');

const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

/**
 * Generate a URL-safe random token.
 * @param {number} [bytes=32] - Amount of randomness in bytes
 * @returns {string} base64url string
 */
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

/**
 * Keyed SHA-256 hash (HMAC). Used to store refresh tokens and backup codes so a
 * database leak alone does not reveal them.
 * @param {string} value - Value to hash
 * @param {string|Buffer} key - Secret key
 * @returns {string} Hex digest
 */
const hmacSha256 = (value, key) => crypto.createHmac('sha256', key).update(value).digest('hex');

/**
 * Compare two strings in constant time (prevents timing attacks on token checks).
 * @param {string} a - First value
 * @param {string} b - Second value
 * @returns {boolean} True when equal
 */
const safeEqual = (a, b) => {
  const bufferA = Buffer.from(String(a));
  const bufferB = Buffer.from(String(b));
  return bufferA.length === bufferB.length && crypto.timingSafeEqual(bufferA, bufferB);
};

/**
 * Encrypt text with AES-256-GCM. Output format: base64url(iv).base64url(tag).base64url(data).
 * @param {string} plaintext - Text to encrypt
 * @param {Buffer} key - 32-byte key
 * @returns {string} Encrypted payload
 */
const encrypt = (plaintext, key) => {
  const iv = crypto.randomBytes(GCM_IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, data].map((part) => part.toString('base64url')).join('.');
};

/**
 * Decrypt a payload produced by encrypt().
 * @param {string} payload - Encrypted payload
 * @param {Buffer} key - 32-byte key
 * @returns {string} Plaintext
 * @throws {Error} If the payload was tampered with or the key is wrong
 */
const decrypt = (payload, key) => {
  const [iv, tag, data] = String(payload)
    .split('.')
    .map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !data || iv.length !== GCM_IV_BYTES || tag.length !== GCM_TAG_BYTES) {
    throw new Error('[crypto] decrypt: malformed payload');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
};

module.exports = { randomToken, hmacSha256, safeEqual, encrypt, decrypt };
