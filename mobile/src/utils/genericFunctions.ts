/**
 * Generic reusable helpers for the buyer app. Check here before writing a new helper.
 * Money from the API is always integer paise; format only at the UI edge.
 */

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/**
 * Format integer paise as rupees with Indian grouping, e.g. 10500000 → "₹1,05,000".
 * @param paise - Amount in paise
 * @returns Formatted amount, or an empty string for invalid input
 */
export function formatINR(paise: number): string {
  return Number.isFinite(paise) ? inrFormatter.format(paise / 100) : '';
}

/**
 * Format basis points as a percentage, e.g. 700 → "7%", 25 → "0.25%".
 * @param bps - Basis points
 * @returns Percentage text
 */
export function formatBps(bps: number): string {
  return `${Number((bps / 100).toFixed(2))}%`;
}

/**
 * Join class names, skipping falsy values.
 * @param classes - Class strings or falsy values
 * @returns Single class string
 */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
