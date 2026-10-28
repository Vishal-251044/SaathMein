/**
 * Unit tests for money helpers (integer paise math).
 */
const {
  isValidPaise,
  rupeesToPaise,
  paiseToRupees,
  percentOfPaise,
  formatINR,
} = require('../../src/utils/money');

describe('money utils', () => {
  it('converts rupees to integer paise without float errors', () => {
    expect(rupeesToPaise(999)).toBe(99900);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
    expect(rupeesToPaise('86,750.50')).toBe(8675050);
  });

  it('rejects invalid amounts and more than 2 decimals', () => {
    expect(() => rupeesToPaise('abc')).toThrow(TypeError);
    expect(() => rupeesToPaise(10.005)).toThrow(TypeError);
  });

  it('validates paise values', () => {
    expect(isValidPaise(100)).toBe(true);
    expect(isValidPaise(0)).toBe(true);
    expect(isValidPaise(10.5)).toBe(false);
    expect(isValidPaise(-1)).toBe(false);
    expect(isValidPaise('100')).toBe(false);
  });

  it('applies basis points with rounding (0.25% of ₹88,000 = ₹220)', () => {
    expect(percentOfPaise(8800000, 25)).toBe(22000);
    expect(percentOfPaise(99900, 250)).toBe(2498); // 2.5% of ₹999 = ₹24.975 → ₹24.98
  });

  it('formats with Indian grouping', () => {
    expect(paiseToRupees(8675000)).toBe(86750);
    expect(formatINR(10500000)).toBe('₹1,05,000');
    expect(formatINR(99950, { showPaise: true })).toBe('₹999.50');
  });
});
