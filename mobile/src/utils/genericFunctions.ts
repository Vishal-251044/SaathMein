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

/** 10-digit Indian mobile number (starts with 6–9). */
export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

/**
 * Keep only digits and drop a leading +91 / 0 that users often paste in.
 * @param input - Raw text from the phone field
 * @returns Up to 10 local digits
 */
export function normaliseIndianMobile(input: string): string {
  const digits = input.replace(/\D/g, '');
  const local = digits.length > 10 ? digits.replace(/^(91|0)/, '') : digits;
  return local.slice(0, 10);
}

/**
 * Convert a 10-digit local number to E.164.
 * @param localNumber - e.g. "9876543210"
 * @returns e.g. "+919876543210"
 */
export function toIndianE164(localNumber: string): string {
  return `+91${localNumber}`;
}

/**
 * Format an E.164 Indian number for display, e.g. "+919876543210" → "+91 98765 43210".
 * @param phone - E.164 phone
 * @returns Readable phone (unchanged if not an Indian number)
 */
export function formatIndianPhone(phone: string | null | undefined): string {
  const match = /^\+91(\d{5})(\d{5})$/.exec(phone ?? '');
  return match ? `+91 ${match[1]} ${match[2]}` : (phone ?? '');
}

/**
 * Join class names, skipping falsy values.
 * @param classes - Class strings or falsy values
 * @returns Single class string
 */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
