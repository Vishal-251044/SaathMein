/**
 * Commission math (F17, PRD §05) for every launch category rule, GST on the monthly
 * invoice (CGST + SGST inside Maharashtra, IGST across states), invoice totals, financial
 * year numbering and IST month boundaries.
 */
const { splitToken, commissionForUnit } = require('../../../src/services/payments/commission');
const {
  gstBreakdown,
  financialYear,
  monthPeriod,
  previousMonthKey,
  invoiceTotals,
} = require('../../../src/services/payments/commission.service');

const TOKEN = 99_900; // ₹999 token

describe('commission for every category (PRD §05 ranges)', () => {
  it.each([
    // [category, rule, price, commission, from token, invoiced, transferred]
    ['car, flat ₹5,000', { type: 'flat', value: 500_000 }, 85_000_000, 500_000, TOKEN, 400_100, 0],
    [
      'two-wheeler, flat ₹1,000',
      { type: 'flat', value: 100_000 },
      9_500_000,
      100_000,
      TOKEN,
      100,
      0,
    ],
    [
      'two-wheeler, flat ₹500',
      { type: 'flat', value: 50_000 },
      9_500_000,
      50_000,
      50_000,
      0,
      49_900,
    ],
    ['mobile, 3%', { type: 'percent', value: 300 }, 2_500_000, 75_000, 75_000, 0, 24_900],
    [
      'laptop, 2% (above the token)',
      { type: 'percent', value: 200 },
      6_000_000,
      120_000,
      TOKEN,
      20_100,
      0,
    ],
    ['groceries, 6%', { type: 'percent', value: 600 }, 500_000, 30_000, 30_000, 0, 69_900],
    ['solar, 2.5%', { type: 'percent', value: 250 }, 15_000_000, 375_000, TOKEN, 275_100, 0],
    ['no rule set', { type: 'percent', value: 0 }, 2_500_000, 0, 0, 0, TOKEN],
  ])('%s', (_label, rule, price, commission, fromToken, invoiced, transfer) => {
    const split = splitToken({ tokenPaise: TOKEN, pricePerUnitPaise: price, rule });
    expect(split).toEqual({
      commissionPaise: commission,
      fromTokenPaise: fromToken,
      invoicedPaise: invoiced,
      transferPaise: transfer,
    });
    // Money never appears or disappears
    expect(split.fromTokenPaise + split.transferPaise).toBe(TOKEN);
    expect(split.fromTokenPaise + split.invoicedPaise).toBe(split.commissionPaise);
  });

  it('rounds percentages to whole paise', () => {
    expect(commissionForUnit({ type: 'percent', value: 333 }, 1_000_001)).toBe(33_300);
  });

  it('refuses rupee floats', () => {
    expect(() =>
      splitToken({ tokenPaise: 999.5, pricePerUnitPaise: 100, rule: { type: 'flat', value: 1 } }),
    ).toThrow(TypeError);
  });
});

describe('GST on commission', () => {
  it('inside the state: half CGST + half SGST', () => {
    expect(gstBreakdown(400_100, 1800, true)).toEqual({
      rateBps: 1800,
      intraState: true,
      cgstPaise: 36_009,
      sgstPaise: 36_009,
      igstPaise: 0,
      totalPaise: 72_018,
    });
  });

  it('across states: IGST', () => {
    expect(gstBreakdown(400_100, 1800, false)).toMatchObject({
      igstPaise: 72_018,
      totalPaise: 72_018,
    });
  });

  it('invoice totals: GST on all commission, minus what tokens already paid', () => {
    const lines = [
      { commissionPaise: 500_000, fromTokenPaise: 99_900 },
      { commissionPaise: 75_000, fromTokenPaise: 75_000 },
    ];
    expect(invoiceTotals(lines, 1800, true)).toMatchObject({
      taxablePaise: 575_000,
      totalPaise: 678_500, // 575,000 + 18%
      fromTokensPaise: 174_900,
      balanceDuePaise: 503_600,
    });
  });

  it('balance due never goes below zero', () => {
    expect(
      invoiceTotals([{ commissionPaise: 100, fromTokenPaise: 100 }], 0, true).balanceDuePaise,
    ).toBe(0);
  });
});

describe('invoice numbering and periods (IST)', () => {
  it('financial year runs April to March in IST', () => {
    expect(financialYear(new Date('2026-03-31T18:00:00Z'))).toBe('2025-26'); // 31 Mar 11:30 pm IST
    expect(financialYear(new Date('2026-03-31T18:30:00Z'))).toBe('2026-27'); // 1 Apr 00:00 IST
    expect(financialYear(new Date('2027-01-15T00:00:00Z'))).toBe('2026-27');
  });

  it('month boundaries are midnight IST', () => {
    expect(monthPeriod('2026-10')).toEqual({
      key: '2026-10',
      from: new Date('2026-09-30T18:30:00Z'),
      to: new Date('2026-10-31T18:30:00Z'),
    });
    expect(() => monthPeriod('2026-13')).toThrow('Month must look like');
  });

  it('previous month on the 1st (IST)', () => {
    expect(previousMonthKey(new Date('2026-10-31T21:30:00Z'))).toBe('2026-10'); // 1 Nov 03:00 IST
    expect(previousMonthKey(new Date('2027-01-01T00:00:00Z'))).toBe('2026-12');
  });
});
