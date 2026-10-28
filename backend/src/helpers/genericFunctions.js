/**
 * Generic reusable helpers shared across services.
 * Check here before writing a new helper (CLAUDE.md §12).
 */

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

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  getPagination,
  buildPaginationMeta,
  slugify,
  maskPhone,
  firstNameOnly,
  pick,
};
