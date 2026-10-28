/**
 * Two-factor service for staff accounts (ADL-2): TOTP secrets (Google Authenticator /
 * Authy), encryption at rest, replay protection and one-time backup codes.
 */
const crypto = require('crypto');
const { generateSecret, generateURI, verify } = require('otplib');
const config = require('../../config/env');
const { encrypt, decrypt, hmacSha256, safeEqual } = require('../../utils/crypto');

const ISSUER = 'SaathMein';
const TOTP_TOLERANCE_SECONDS = 30; // accept the previous and next 30 s code (clock drift)
const BACKUP_CODE_COUNT = 10;
// No 0/O, 1/I/L to avoid misreading when typing a code from paper
const BACKUP_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** @returns {string} New base32 TOTP secret (160 bits) */
const createTotpSecret = () => generateSecret();

/**
 * Build the otpauth:// link an authenticator app understands.
 * @param {string} secret - Base32 secret
 * @param {string} email - Staff email shown in the authenticator
 * @returns {string} otpauth URL
 */
const buildOtpAuthUrl = (secret, email) => generateURI({ issuer: ISSUER, label: email, secret });

/** @param {string} secret - Plain base32 secret @returns {string} Encrypted secret for the DB */
const encryptSecret = (secret) => encrypt(secret, config.auth.twoFactorKey);

/** @param {string} payload - Encrypted secret from the DB @returns {string} Plain base32 secret */
const decryptSecret = (payload) => decrypt(payload, config.auth.twoFactorKey);

/**
 * Verify a 6-digit TOTP code. A code is rejected if its time step was already used,
 * so an observed code cannot be replayed.
 * @param {string} secret - Plain base32 secret
 * @param {string} code - 6-digit code typed by the user
 * @param {number} [lastUsedStep] - Time step of the last accepted code
 * @returns {Promise<{ valid: boolean, timeStep?: number }>}
 */
const verifyTotpCode = async (secret, code, lastUsedStep) => {
  if (!/^\d{6}$/.test(String(code))) return { valid: false };
  const result = await verify({
    secret,
    token: String(code),
    epochTolerance: TOTP_TOLERANCE_SECONDS,
  });
  if (!result.valid) return { valid: false };
  if (Number.isFinite(lastUsedStep) && result.timeStep <= lastUsedStep) return { valid: false };
  return { valid: true, timeStep: result.timeStep };
};

/**
 * Normalise a backup code typed by a user ("abcd efgh" → "ABCDEFGH").
 * @param {string} code - Raw input
 * @returns {string} Uppercase code without separators
 */
const normaliseBackupCode = (code) => String(code).toUpperCase().replace(/[\s-]/g, '');

/**
 * Whether input looks like a backup code (8 characters) rather than a TOTP code (6 digits).
 * @param {string} code - Raw input
 * @returns {boolean}
 */
const isBackupCodeFormat = (code) => /^[A-Z0-9]{8}$/.test(normaliseBackupCode(code));

/** @param {string} code - Backup code @returns {string} Keyed hash stored in the DB */
const hashBackupCode = (code) => hmacSha256(normaliseBackupCode(code), config.auth.twoFactorKey);

/**
 * Generate a fresh set of backup codes.
 * @param {number} [count=10] - How many codes
 * @returns {{ codes: string[], stored: { hash: string }[] }} Plain codes (shown once) and hashes
 */
const generateBackupCodes = (count = BACKUP_CODE_COUNT) => {
  const codes = Array.from({ length: count }, () => {
    const chars = Array.from(
      { length: 8 },
      () => BACKUP_CODE_ALPHABET[crypto.randomInt(BACKUP_CODE_ALPHABET.length)],
    ).join('');
    return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  });
  return { codes, stored: codes.map((code) => ({ hash: hashBackupCode(code) })) };
};

/**
 * Find an unused backup code that matches the input.
 * @param {{ hash: string, usedAt?: Date }[]} storedCodes - Codes from the user record
 * @param {string} code - Code typed by the user
 * @returns {number} Index of the matching unused code, or -1
 */
const findUnusedBackupCode = (storedCodes = [], code) => {
  const hash = hashBackupCode(code);
  return storedCodes.findIndex((stored) => !stored.usedAt && safeEqual(stored.hash, hash));
};

module.exports = {
  createTotpSecret,
  buildOtpAuthUrl,
  encryptSecret,
  decryptSecret,
  verifyTotpCode,
  isBackupCodeFormat,
  generateBackupCodes,
  findUnusedBackupCode,
};
