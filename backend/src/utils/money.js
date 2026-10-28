/**
 * Money helpers. All amounts in SaathMein are stored and calculated as INTEGER PAISE
 * (₹999.00 = 99900). Never use floating-point rupees for storage or math.
 * Percentages are stored as integer basis points (1% = 100 bps, 0.25% = 25 bps).
 */

const PAISE_PER_RUPEE = 100;
const BPS_PER_WHOLE = 10000;

/**
 * Check that a value is a valid non-negative integer amount in paise.
 * @param {*} value - Value to check
 * @returns {boolean} True when the value is a safe non-negative integer
 */
const isValidPaise = (value) => Number.isSafeInteger(value) && value >= 0;

/**
 * Convert rupees (e.g. from a CSV or admin form) to integer paise.
 * @param {number|string} rupees - Amount in rupees, up to 2 decimals
 * @returns {number} Amount in paise
 * @throws {TypeError} If the input is not a finite number or has more than 2 decimals
 */
const rupeesToPaise = (rupees) => {
  const value = typeof rupees === 'string' ? Number(rupees.replace(/,/g, '')) : rupees;
  if (!Number.isFinite(value)) {
    throw new TypeError(`[money] rupeesToPaise: invalid amount "${rupees}"`);
  }
  const paise = Math.round(value * PAISE_PER_RUPEE);
  // Reject values like 10.005 that cannot be represented in whole paise
  if (Math.abs(paise - value * PAISE_PER_RUPEE) > 1e-6) {
    throw new TypeError(`[money] rupeesToPaise: more than 2 decimals in "${rupees}"`);
  }
  return paise;
};

/**
 * Convert integer paise to rupees (only for display or external APIs that need rupees).
 * @param {number} paise - Amount in paise
 * @returns {number} Amount in rupees
 */
const paiseToRupees = (paise) => paise / PAISE_PER_RUPEE;

/**
 * Apply a percentage in basis points to an amount, rounding half up to whole paise.
 * Example: percentOfPaise(8800000, 25) → 22000 (0.25% of ₹88,000 = ₹220).
 * @param {number} amountPaise - Base amount in paise
 * @param {number} bps - Percentage in basis points
 * @returns {number} Result in paise
 */
const percentOfPaise = (amountPaise, bps) => Math.round((amountPaise * bps) / BPS_PER_WHOLE);

/**
 * Format paise as Indian rupees with lakh/crore grouping, e.g. 8675000 → "₹86,750".
 * @param {number} paise - Amount in paise
 * @param {Object} [options]
 * @param {boolean} [options.showPaise=false] - Show 2 decimals
 * @returns {string} Formatted amount
 */
const formatINR = (paise, { showPaise = false } = {}) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showPaise ? 2 : 0,
    maximumFractionDigits: showPaise ? 2 : 0,
  }).format(paiseToRupees(paise));

module.exports = {
  PAISE_PER_RUPEE,
  BPS_PER_WHOLE,
  isValidPaise,
  rupeesToPaise,
  paiseToRupees,
  percentOfPaise,
  formatINR,
};
