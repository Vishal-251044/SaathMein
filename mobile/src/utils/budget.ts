/**
 * Budget slider maths. One slider covers phones (₹10,000) to cars (₹50 lakh), so it uses a
 * logarithmic scale and snaps to round amounts. All amounts are integer paise.
 */

export const BUDGET_MIN_PAISE = 10_000 * 100; // ₹10,000
export const BUDGET_MAX_PAISE = 50_00_000 * 100; // ₹50 lakh

const LAKH_PAISE = 1_00_000 * 100;
const THOUSAND_PAISE = 1_000 * 100;

/**
 * Round to a friendly step: ₹5,000 below ₹1 lakh, ₹25,000 below ₹10 lakh, ₹1 lakh above.
 * @param paise - Raw amount
 * @returns Rounded amount in paise
 */
export function snapBudget(paise: number): number {
  const step =
    paise < LAKH_PAISE
      ? 5 * THOUSAND_PAISE
      : paise < 10 * LAKH_PAISE
        ? 25 * THOUSAND_PAISE
        : LAKH_PAISE;
  return Math.min(BUDGET_MAX_PAISE, Math.max(BUDGET_MIN_PAISE, Math.round(paise / step) * step));
}

/**
 * Slider position (0–1) → budget.
 * @param position - 0 at the left end, 1 at the right end
 * @returns Snapped budget in paise
 */
export function positionToBudget(position: number): number {
  'worklet';
  const clamped = Math.min(1, Math.max(0, position));
  return BUDGET_MIN_PAISE * (BUDGET_MAX_PAISE / BUDGET_MIN_PAISE) ** clamped;
}

/**
 * Budget → slider position (0–1).
 * @param paise - Budget in paise
 * @returns Position
 */
export function budgetToPosition(paise: number): number {
  const clamped = Math.min(BUDGET_MAX_PAISE, Math.max(BUDGET_MIN_PAISE, paise));
  return Math.log(clamped / BUDGET_MIN_PAISE) / Math.log(BUDGET_MAX_PAISE / BUDGET_MIN_PAISE);
}

/**
 * Short Indian-style amount for chips and slider labels: ₹80K, ₹1.2L, ₹15L.
 * @param paise - Amount in paise
 * @returns Short label
 */
export function formatBudgetShort(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 1_00_000) {
    const lakhs = rupees / 1_00_000;
    return `₹${Number(lakhs.toFixed(lakhs < 10 ? 1 : 0))}L`;
  }
  return `₹${Math.round(rupees / 1000)}K`;
}
