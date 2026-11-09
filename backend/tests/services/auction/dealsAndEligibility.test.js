/**
 * Seller-led deal tiers (AUC-9) and who may bid (PRD §10.5, open question 2 decided
 * 8 Nov 2026: verified unrated dealers may bid; 3.5+ applies from 3 reviews).
 */
const { Types } = require('mongoose');
const {
  tierPricePaise,
  dealStatus,
  assertValidTiers,
} = require('../../../src/services/deals/deal.service');
const {
  ineligibilityReason,
  businessIneligibility,
} = require('../../../src/services/auction/eligibility');

const RULES = { minSize: 5, maxSize: 50 };
const SETTINGS = { minRating: 3.5, minReviewsForRating: 3 };

describe('seller-led deal tiers', () => {
  const deal = {
    basePricePaise: 10_000_000, // ₹1,00,000
    tiers: [
      { size: 5, discountBps: 300 },
      { size: 10, discountBps: 600 },
      { size: 20, discountBps: 1000 },
    ],
  };

  it('prices a tier in whole paise', () => {
    expect(tierPricePaise(10_000_000, 300)).toBe(9_700_000);
    expect(tierPricePaise(999_99, 333)).toBe(999_99 - Math.round((999_99 * 333) / 10_000));
  });

  it('shows base price and "X more to unlock" before the first tier', () => {
    expect(dealStatus(deal, 3)).toMatchObject({
      currentTier: null,
      pricePaise: 10_000_000,
      membersToNext: 2,
      nextTier: { size: 5, pricePaise: 9_700_000 },
    });
  });

  it('drops the price for everyone when a tier is reached', () => {
    expect(dealStatus(deal, 12)).toMatchObject({
      currentTier: { size: 10 },
      pricePaise: 9_400_000,
      membersToNext: 8,
    });
    expect(dealStatus(deal, 20)).toMatchObject({ pricePaise: 9_000_000, nextTier: null });
  });

  it('accepts 2–4 increasing tiers within the category sizes', () => {
    expect(() => assertValidTiers(deal.tiers, RULES)).not.toThrow();
    const bad = (tiers) => () => assertValidTiers(tiers, RULES);
    expect(bad([{ size: 5, discountBps: 300 }])).toThrow('2 to 4');
    expect(
      bad([
        { size: 5, discountBps: 300 },
        { size: 5, discountBps: 600 },
      ]),
    ).toThrow('more people');
    expect(
      bad([
        { size: 5, discountBps: 600 },
        { size: 10, discountBps: 300 },
      ]),
    ).toThrow('bigger discount');
    expect(
      bad([
        { size: 3, discountBps: 300 },
        { size: 10, discountBps: 600 },
      ]),
    ).toThrow('at least 5');
    expect(
      bad([
        { size: 5, discountBps: 300 },
        { size: 60, discountBps: 600 },
      ]),
    ).toThrow('at most 50');
  });
});

describe('auction eligibility', () => {
  const cityId = new Types.ObjectId();
  const categoryId = new Types.ObjectId();
  const group = { cityId, categoryId };
  const seller = (overrides = {}) => ({
    kyc: { status: 'approved' },
    status: 'active',
    cities: [cityId],
    categories: [categoryId],
    rating: 0,
    ratingCount: 0,
    penalties: [],
    ...overrides,
  });

  it('allows verified unrated dealers (fewer than 3 reviews)', () => {
    expect(ineligibilityReason(seller({ rating: 2, ratingCount: 2 }), group, SETTINGS)).toBeNull();
  });

  it('blocks rated dealers below 3.5', () => {
    expect(ineligibilityReason(seller({ rating: 3.4, ratingCount: 3 }), group, SETTINGS)).toBe(
      'RATING_TOO_LOW',
    );
    expect(
      ineligibilityReason(seller({ rating: 3.5, ratingCount: 3 }), group, SETTINGS),
    ).toBeNull();
  });

  it('needs approved KYC, an active account and no live auction suspension', () => {
    expect(businessIneligibility(null, SETTINGS)).toBe('NOT_A_DEALER');
    expect(businessIneligibility(seller({ kyc: { status: 'pending' } }), SETTINGS)).toBe(
      'KYC_NOT_APPROVED',
    );
    expect(businessIneligibility(seller({ status: 'suspended' }), SETTINGS)).toBe(
      'SELLER_SUSPENDED',
    );
    const now = new Date('2026-11-08T10:00:00Z');
    const suspended = seller({
      penalties: [{ type: 'auction_suspension', until: new Date('2026-12-01') }],
    });
    expect(businessIneligibility(suspended, SETTINGS, now)).toBe('AUCTIONS_SUSPENDED');
    const served = seller({
      penalties: [{ type: 'auction_suspension', until: new Date('2026-11-01') }],
    });
    expect(businessIneligibility(served, SETTINGS, now)).toBeNull();
  });

  it('must cover the group city and category', () => {
    expect(ineligibilityReason(seller({ cities: [] }), group, SETTINGS)).toBe('CITY_NOT_COVERED');
    expect(ineligibilityReason(seller({ categories: [] }), group, SETTINGS)).toBe(
      'CATEGORY_NOT_COVERED',
    );
  });
});
