/**
 * Generic reusable helpers shared across services.
 * Check here before writing a new helper (CLAUDE.md §12).
 */
const crypto = require('crypto');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Build safe pagination values from query params.
 * @param {Object} query - Request query, e.g. `{ page: '2', limit: '20' }`
 * @returns {{ page: number, limit: number, skip: number }} Normalised pagination
 */
const getPagination = (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requested = Number.parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE;
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, requested));
  return { page, limit, skip: (page - 1) * limit };
};

/**
 * Build the pagination `meta` block for list responses.
 * @param {number} total - Total matching documents
 * @param {{ page: number, limit: number }} pagination - Values from getPagination
 * @returns {{ page: number, limit: number, total: number, totalPages: number, hasNextPage: boolean }}
 */
const buildPaginationMeta = (total, { page, limit }) => {
  const totalPages = Math.ceil(total / limit) || 0;
  return { page, limit, total, totalPages, hasNextPage: page < totalPages };
};

/**
 * Turn text into a URL-safe slug, e.g. "Honda Activa 6G" → "honda-activa-6g".
 * @param {string} text - Input text
 * @returns {string} Slug
 */
const slugify = (text = '') =>
  String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Mask a phone number for logs and other members, e.g. "+919876543210" → "+91******3210".
 * @param {string} phone - Phone in E.164 format
 * @returns {string} Masked phone
 */
const maskPhone = (phone = '') => {
  const value = String(phone);
  if (value.length <= 4) return '****';
  const countryCode = value.startsWith('+91') ? '+91' : '';
  const local = value.slice(countryCode.length);
  return `${countryCode}${'*'.repeat(Math.max(0, local.length - 4))}${local.slice(-4)}`;
};

/**
 * Return only the first name, used wherever members are shown to each other (privacy).
 * @param {string} fullName - Full name
 * @returns {string} First name
 */
const firstNameOnly = (fullName = '') => String(fullName).trim().split(/\s+/)[0] || '';

/**
 * Pick only the listed keys from an object (for safe updates from request bodies).
 * @param {Object} source - Source object
 * @param {string[]} keys - Allowed keys
 * @returns {Object} New object with only the allowed keys that exist on source
 */
const pick = (source = {}, keys = []) =>
  keys.reduce((result, key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) result[key] = source[key];
    return result;
  }, {});

const DURATION_UNITS_MS = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };

/**
 * Parse a duration string like "15m", "8h", "30d" or "45s" into milliseconds.
 * @param {string} value - Duration with a single unit suffix
 * @returns {number} Milliseconds, or NaN when the format is invalid
 */
const parseDurationToMs = (value) => {
  const match = /^(\d+)\s*([smhd])$/.exec(String(value).trim());
  if (!match) return Number.NaN;
  return Number(match[1]) * DURATION_UNITS_MS[match[2]];
};

const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance between two points (haversine).
 * @param {[number, number]} from - [longitude, latitude]
 * @param {[number, number]} to - [longitude, latitude]
 * @returns {number} Distance in kilometres
 */
const distanceKm = ([lng1, lat1], [lng2, lat2]) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
};

// No 0/O, 1/I/L: codes are read aloud and typed from WhatsApp messages
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Random human-friendly code (group invite codes, deal codes).
 * @param {number} [length=8] - Number of characters
 * @returns {string} e.g. "K7M2QX9P"
 */
const generateCode = (length = 8) =>
  Array.from({ length }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');

module.exports = {
  DEFAULT_PAGE_SIZE,
  generateCode,
  parseDurationToMs,
  distanceKm,
  MAX_PAGE_SIZE,
  getPagination,
  buildPaginationMeta,
  slugify,
  maskPhone,
  firstNameOnly,
  pick,
};
