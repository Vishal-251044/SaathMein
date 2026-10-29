/**
 * Money input helpers for admin forms. The API works in integer paise and basis points;
 * staff type rupees and percentages. Convert only at the form edge.
 */

/**
 * Rupees text → integer paise.
 * @param {string} text - e.g. "78000", "81,000.50", "" (empty = no value)
 * @returns {number|null|undefined} Paise; null for empty; undefined for invalid input
 */
export const rupeesInputToPaise = (text) => {
  const clean = String(text ?? '').replace(/[,\s₹]/g, '');
  if (clean === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return undefined;
  return Math.round(Number(clean) * 100);
};

/**
 * Integer paise → rupees text for an input.
 * @param {number|null|undefined} paise - Amount in paise
 * @returns {string} e.g. "78000" or "81000.5" ("" when empty)
 */
export const paiseToRupeesInput = (paise) => (paise == null ? '' : String(paise / 100));

/**
 * Percentage text → basis points (2.5 → 250).
 * @param {string} text - Percentage
 * @returns {number|null|undefined} Basis points; null for empty; undefined for invalid
 */
export const percentInputToBps = (text) => {
  const clean = String(text ?? '').trim();
  if (clean === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return undefined;
  return Math.round(Number(clean) * 100);
};

/**
 * Basis points → percentage text (250 → "2.5").
 * @param {number|null|undefined} bps - Basis points
 * @returns {string}
 */
export const bpsToPercentInput = (bps) => (bps == null ? '' : String(bps / 100));
