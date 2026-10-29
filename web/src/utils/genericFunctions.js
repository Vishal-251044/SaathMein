/**
 * Generic reusable helpers for the web app. Check here before writing a new helper.
 * Money is always integer paise from the API; format only at the UI edge.
 */
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind class names, letting later classes override earlier ones.
 * @param {...(string|Object|Array|undefined|null|false)} inputs - Class values
 * @returns {string} Merged class string
 */
export const cn = (...inputs) => twMerge(clsx(inputs));

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/**
 * Format integer paise as rupees with Indian grouping, e.g. 6800000 → "₹68,000".
 * @param {number} paise - Amount in paise
 * @returns {string} Formatted amount, or an empty string for invalid input
 */
export const formatINR = (paise) =>
  Number.isFinite(paise) ? inrFormatter.format(paise / 100) : '';

/**
 * Format basis points as a percentage, e.g. 700 → "7%", 25 → "0.25%".
 * @param {number} bps - Basis points
 * @returns {string} Percentage text
 */
export const formatBps = (bps) => `${Number((bps / 100).toFixed(2))}%`;

/**
 * Format a count as "14 of 20".
 * @param {number} count - Current members
 * @param {number} target - Target size
 * @returns {string} Counter text
 */
export const formatMemberCount = (count, target) => `${count} of ${target}`;

/**
 * URL-safe slug, identical to the backend's slugify ("H-Smart Edition" → "h-smart-edition").
 * Used to predict variant keys before a product is saved.
 * @param {string} text - Input
 * @returns {string} Slug
 */
export const slugify = (text = '') =>
  String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Parse a comma/space separated list of pincodes, keeping valid unique 6-digit codes.
 * @param {string} text - e.g. "411038, 411052 411038"
 * @returns {{ pincodes: string[], invalid: string[] }} Valid codes and rejected entries
 */
export const parsePincodes = (text = '') => {
  const entries = text.split(/[\s,]+/).filter(Boolean);
  const pincodes = [...new Set(entries.filter((entry) => /^[1-9]\d{5}$/.test(entry)))];
  const invalid = entries.filter((entry) => !/^[1-9]\d{5}$/.test(entry));
  return { pincodes, invalid };
};
