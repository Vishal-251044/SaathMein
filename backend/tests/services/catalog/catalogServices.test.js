/**
 * Tests for price history diffs (CAT-5), the fuzzy search fallback (DIS-2) and the public
 * product presenter (city prices, "from" price).
 */
const { Types } = require('mongoose');
const Product = require('../../../src/models/product.model');
const { changedPrices } = require('../../../src/services/catalog/priceHistory.service');
const {
  searchWithFallback,
  invalidateSearchCache,
} = require('../../../src/services/catalog/productSearch.service');
const {
  toPublicProduct,
  toProductCard,
} = require('../../../src/services/catalog/productPresenter');

const pune = new Types.ObjectId();
const mumbai = new Types.ObjectId();

describe('price history diffs', () => {
  it('reports only new or changed city/variant prices', () => {
    const before = [
      { cityId: pune, variantKey: 'std', exShowroomPaise: 7800000 },
      { cityId: pune, variantKey: 'dlx', exShowroomPaise: 8100000 },
    ];
    const after = [
      { cityId: pune, variantKey: 'std', exShowroomPaise: 7800000 }, // same
      { cityId: pune, variantKey: 'dlx', exShowroomPaise: 8050000 }, // changed
      { cityId: mumbai, variantKey: 'std', exShowroomPaise: 7900000 }, // new
    ];
    expect(
      changedPrices(before, after).map(
        (p) => `${String(p.cityId) === String(pune) ? 'pune' : 'mumbai'}:${p.variantKey}`,
      ),
    ).toEqual(['pune:dlx', 'mumbai:std']);
  });
});

describe('search fallback', () => {
  const docs = [
    {
      _id: new Types.ObjectId(),
      brand: 'Honda',
      model: 'Activa 6G',
      tags: ['scooter'],
      categoryId: new Types.ObjectId(),
    },
    {
      _id: new Types.ObjectId(),
      brand: 'Honda',
      model: 'Activa 125',
      tags: ['scooter'],
      categoryId: new Types.ObjectId(),
    },
    {
      _id: new Types.ObjectId(),
      brand: 'TVS',
      model: 'Jupiter',
      tags: ['scooter'],
      categoryId: new Types.ObjectId(),
    },
  ];

  beforeEach(() => {
    invalidateSearchCache();
    jest.spyOn(Product, 'find').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(docs) }),
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('finds both Activas for the typo "actva" and leaves out Jupiter', async () => {
    const ids = await searchWithFallback({ q: 'actva', skip: 0, limit: 10 });
    expect(ids).toEqual(expect.arrayContaining([String(docs[0]._id), String(docs[1]._id)]));
    expect(ids).not.toContain(String(docs[2]._id));
  });

  it('matches tags and paginates', async () => {
    const page1 = await searchWithFallback({ q: 'scooter', skip: 0, limit: 2 });
    expect(page1).toHaveLength(3); // limit + 1 so the caller knows there is a next page
    const page2 = await searchWithFallback({ q: 'scooter', skip: 2, limit: 2 });
    expect(page2).toHaveLength(1);
  });
});

describe('product presenter', () => {
  const product = {
    _id: new Types.ObjectId(),
    slug: 'honda-activa-6g',
    brand: 'Honda',
    model: 'Activa 6G',
    categoryId: new Types.ObjectId(),
    variants: [{ key: 'std', name: 'STD', attrs: new Map([['trim', 'STD']]) }],
    specs: new Map([['Engine', '109.51 cc']]),
    images: [{ url: 'https://res.cloudinary.com/x/image/upload/a.jpg', publicId: 'a' }],
    priceByCity: [
      { cityId: pune, variantKey: 'std', exShowroomPaise: 7800000, onRoadPaise: 9200000 },
      { cityId: pune, variantKey: 'dlx', exShowroomPaise: 8100000 },
      { cityId: mumbai, variantKey: 'std', exShowroomPaise: 7700000 },
    ],
  };

  it('shows only the buyer city prices and the lowest headline price', () => {
    const result = toPublicProduct(product, String(pune));
    expect(result.prices).toHaveLength(2);
    expect(result.prices[0].pricePaise).toBe(9200000); // on-road wins over ex-showroom
    expect(result.fromPricePaise).toBe(8100000);
    expect(result.specs).toEqual({ Engine: '109.51 cc' });
    expect(result.variants[0].attrs).toEqual({ trim: 'STD' });
    expect(result.images[0]).toEqual({ url: product.images[0].url }); // no Cloudinary public ids
  });

  it('has no price for a city without prices', () => {
    expect(toProductCard(product, String(new Types.ObjectId())).fromPricePaise).toBeNull();
  });
});
