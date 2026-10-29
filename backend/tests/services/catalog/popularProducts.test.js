/**
 * "Popular in <city>" (Home rail, Day 5): products ranked by distinct interested buyers in
 * the city, topped up alphabetically when there are too few signals.
 */
jest.mock('../../../src/models/demandSignal.model', () => ({ aggregate: jest.fn() }));
jest.mock('../../../src/models/product.model', () => ({ find: jest.fn() }));

const { Types } = require('mongoose');
const DemandSignal = require('../../../src/models/demandSignal.model');
const Product = require('../../../src/models/product.model');
const { listProducts } = require('../../../src/services/catalog/productQuery.service');

const cityId = new Types.ObjectId().toString();
const product = (model) => ({
  _id: new Types.ObjectId(),
  brand: 'Honda',
  model,
  slug: model.toLowerCase(),
  categoryId: new Types.ObjectId(),
  images: [],
  variants: [],
  priceByCity: [],
});

describe('listProducts sort=popular', () => {
  it('puts the most wanted products first and fills the rest', async () => {
    const shine = product('Shine');
    const activa = product('Activa');
    const dio = product('Dio');
    DemandSignal.aggregate.mockResolvedValue([{ _id: shine._id }, { _id: activa._id }]);
    Product.find
      // findInOrder: ranked products (any order from the database)
      .mockReturnValueOnce({ lean: async () => [activa, shine] })
      // filler: alphabetical, excluding the ranked ones
      .mockReturnValueOnce({ sort: () => ({ limit: () => ({ lean: async () => [dio] }) }) });

    const { products, meta } = await listProducts({ cityId, sort: 'popular', limit: '3' });

    expect(products.map((card) => card.model)).toEqual(['Shine', 'Activa', 'Dio']);
    expect(meta.hasNextPage).toBe(false);
    const [pipeline] = DemandSignal.aggregate.mock.calls[0];
    expect(String(pipeline[0].$match.cityId)).toBe(cityId);
    expect(Product.find.mock.calls[1][0]._id.$nin).toEqual([shine._id, activa._id]);
  });
});
