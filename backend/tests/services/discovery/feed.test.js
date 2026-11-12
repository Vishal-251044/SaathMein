/**
 * Home feed (DIS-1): ranking v1 (fill, urgency, interests, freshness), sections for the
 * buyer's city, only public groups, Trending from cached join counts, seller deals behind
 * their feature flag, banners without a city.
 */
jest.mock('../../../src/services/settings.service', () => ({
  getFeatureFlags: jest.fn(async () => ({ sellerDeals: true, referrals: true })),
}));
jest.mock('../../../src/services/category.service', () => ({
  getActiveCategoryTree: jest.fn(async () => [{ id: 'c', children: [] }]),
}));
jest.mock('../../../src/services/cache.service', () => ({
  remember: jest.fn(async (key, ttl, compute) => compute()),
}));

const { Types } = require('mongoose');
const Group = require('../../../src/models/group.model');
const GroupMember = require('../../../src/models/groupMember.model');
const User = require('../../../src/models/user.model');
const CurationItem = require('../../../src/models/curationItem.model');
const { getFeatureFlags } = require('../../../src/services/settings.service');
const { remember } = require('../../../src/services/cache.service');
const { scoreGroup, rankGroups, getHomeFeed } = require('../../../src/services/feed/feed.service');

const NOW = new Date('2026-11-12T10:00:00Z');
const HOUR = 3_600_000;
const cityId = String(new Types.ObjectId());
const mobiles = new Types.ObjectId();
const bikes = new Types.ObjectId();

const group = (overrides = {}) => ({
  _id: new Types.ObjectId(),
  type: 'buyer_led',
  visibility: 'public',
  status: 'open',
  categoryId: mobiles,
  cityId,
  memberCount: 5,
  targetSize: 10,
  deadline: new Date(NOW.getTime() + 3 * 24 * HOUR),
  createdAt: new Date(NOW.getTime() - 2 * 24 * HOUR),
  productId: { _id: new Types.ObjectId(), brand: 'Apple', model: 'iPhone 17', images: [] },
  ...overrides,
});
const query = (value) => {
  const chain = {
    sort: () => chain,
    limit: () => chain,
    select: () => chain,
    populate: () => chain,
    lean: async () => value,
  };
  return chain;
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('ranking v1', () => {
  it('prefers fuller, sooner, matching groups', () => {
    const viewer = { interestCategoryIds: new Set([String(mobiles)]) };
    const nearlyFull = group({ memberCount: 9 });
    const empty = group({ memberCount: 0 });
    const closingSoon = group({ deadline: new Date(NOW.getTime() + 2 * HOUR) });
    const notMyInterest = group({ categoryId: bikes });
    expect(scoreGroup(nearlyFull, viewer, NOW)).toBeGreaterThan(scoreGroup(empty, viewer, NOW));
    expect(scoreGroup(closingSoon, viewer, NOW)).toBeGreaterThan(scoreGroup(group(), viewer, NOW));
    expect(scoreGroup(group(), viewer, NOW)).toBeGreaterThan(
      scoreGroup(notMyInterest, viewer, NOW),
    );
    expect(rankGroups([empty, nearlyFull], viewer, NOW)[0]).toBe(nearlyFull);
  });

  it('stays between 0 and 1', () => {
    const score = scoreGroup(
      group({ memberCount: 50, deadline: new Date(NOW.getTime() - 1) }),
      {},
      NOW,
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('getHomeFeed', () => {
  const givenFeed = ({ user, curation = [], trending = [] } = {}) => {
    jest.spyOn(User, 'findById').mockReturnValue(query(user));
    jest.spyOn(CurationItem, 'find').mockReturnValue(query(curation));
    jest.spyOn(GroupMember, 'aggregate').mockResolvedValue(trending);
    return jest.spyOn(Group, 'find').mockImplementation(() => query([group()]));
  };

  it('builds the sections for my city, with public groups only', async () => {
    const find = givenFeed({
      user: { cityId, area: 'Kothrud', interests: { categories: [mobiles] } },
      trending: [],
    });
    const feed = await getHomeFeed({ userId: 'u1' }, {}, NOW);

    expect(feed.cityId).toBe(cityId);
    expect(feed.sections.map((section) => section.key)).toEqual([
      'near_you',
      'ending_soon',
      'almost_full',
      'seller_deals',
    ]);
    // Every query is scoped to my city and public groups (community groups never show)
    for (const [filter] of find.mock.calls) {
      expect(filter).toMatchObject({ cityId, visibility: 'public' });
    }
    const nearYou = find.mock.calls.find(([filter]) => filter.area);
    expect(nearYou[0]).toMatchObject({ area: 'Kothrud', status: 'open' });
    expect(remember).toHaveBeenCalledWith(`feed:trending:${cityId}`, 300, expect.any(Function));
  });

  it('hides seller deals when the flag is off', async () => {
    getFeatureFlags.mockResolvedValueOnce({ sellerDeals: false });
    const find = givenFeed({ user: { cityId } });
    const feed = await getHomeFeed({ userId: 'u1' }, {}, NOW);
    expect(feed.sections.map((section) => section.key)).not.toContain('seller_deals');
    expect(find.mock.calls.some(([filter]) => filter.type === 'seller_led')).toBe(false);
  });

  it('without a city: banners and categories only', async () => {
    givenFeed({
      curation: [{ _id: new Types.ObjectId(), type: 'banner', title: 'Diwali group deals' }],
    });
    const feed = await getHomeFeed({}, {}, NOW);
    expect(feed).toMatchObject({ cityId: null, sections: [] });
    expect(feed.banners[0].title).toBe('Diwali group deals');
  });
});
