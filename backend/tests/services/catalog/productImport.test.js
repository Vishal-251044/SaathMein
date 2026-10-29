/**
 * Tests for product CSV import (CAT-3): row validation, failed-row report, merging rows into
 * products/variants/prices, and a dry run of the full starter launch catalog.
 */
jest.mock('../../../src/models/category.model', () => ({ find: jest.fn() }));
jest.mock('../../../src/models/city.model', () => ({ find: jest.fn() }));
jest.mock('../../../src/services/catalog/priceHistory.service', () => ({
  ...jest.requireActual('../../../src/services/catalog/priceHistory.service'),
  recordPriceChanges: jest.fn(async () => 1),
}));

const fs = require('fs');
const path = require('path');
const { Types } = require('mongoose');
const Category = require('../../../src/models/category.model');
const City = require('../../../src/models/city.model');
const Product = require('../../../src/models/product.model');
const categoryTree = require('../../../src/scripts/data/categories.data');
const { importProductsCsv } = require('../../../src/services/catalog/productImport.service');

const HEADER =
  'category,brand,model,variant,variant_attrs,city,mrp,ex_showroom,on_road,tags,specs,description,image_urls,active,needs_review';

// Reference data shaped like the seeded database
const categories = categoryTree.flatMap((parent) => {
  const parentDoc = { _id: new Types.ObjectId(), slug: parent.slug, parentId: null };
  return [
    parentDoc,
    ...parent.children.map((child) => ({
      _id: new Types.ObjectId(),
      slug: child.slug,
      parentId: parentDoc._id,
    })),
  ];
});
const pune = { _id: new Types.ObjectId(), slug: 'pune' };

beforeEach(() => {
  Category.find.mockReturnValue({ lean: () => Promise.resolve(categories) });
  City.find.mockReturnValue({ lean: () => Promise.resolve([pune]) });
  jest.spyOn(Product, 'find').mockResolvedValue([]);
  jest.spyOn(Product.prototype, 'save').mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('importProductsCsv', () => {
  it('rejects files without required columns or with unknown ones', async () => {
    await expect(importProductsCsv('brand,model\nHonda,Activa')).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('category'),
    });
    await expect(importProductsCsv('category,brand,model,colour\nx,y,z,red')).rejects.toMatchObject(
      {
        message: expect.stringContaining('Unknown columns: colour'),
      },
    );
  });

  it('reports failed rows with reasons and still imports the valid ones', async () => {
    const csv = [
      HEADER,
      'two-wheelers,Honda,Activa 6G,STD,trim=STD,pune,,78000,,scooter,Engine=109.51 cc,,,true,false',
      'two-wheelers,Honda,Activa 6G,DLX,trim=DLX,pune,,"81,000",,,,,,,', // same product, 2nd variant
      'vehicles,Honda,Wrong Level,,,pune,,1000,,,,,,,', // parent category
      'two-wheelers,,No Brand,,,pune,,1000,,,,,,,',
      'two-wheelers,TVS,Jupiter,,,mumbai,,77000,,,,,,,', // unknown city
      'two-wheelers,TVS,Ntorq,,,pune,,,,,,,,,', // city but no price
      'two-wheelers,Bajaj,Chetak,,,pune,,12.345,,,,,,,', // 3 decimals
      'two-wheelers,Ather,450X,,,,,,,,,,http://insecure.example/a.jpg,,',
    ].join('\n');

    const report = await importProductsCsv(csv, { dryRun: false, staffUserId: 'staff-1' });

    expect(report).toMatchObject({
      totalRows: 8,
      importedRows: 2,
      productsCreated: 1,
      productsUpdated: 0,
    });
    const reasons = Object.fromEntries(
      report.failedRows.map(({ row, errors }) => [row, errors.join(' | ')]),
    );
    expect(reasons[4]).toMatch(/has sub-categories/);
    expect(reasons[5]).toMatch(/brand is required/);
    expect(reasons[6]).toMatch(/city "mumbai" does not exist/);
    expect(reasons[7]).toMatch(/no mrp, ex_showroom or on_road/);
    expect(reasons[8]).toMatch(/more than 2 decimals/);
    expect(reasons[9]).toMatch(/https/);
    expect(Product.prototype.save).toHaveBeenCalledTimes(1);
  });

  it('merges rows into one product with variants and per-variant city prices in paise', async () => {
    let saved;
    Product.prototype.save.mockImplementation(function captureSave() {
      saved = this;
      return Promise.resolve();
    });
    const csv = [
      HEADER,
      'two-wheelers,Honda,Activa 6G,STD,trim=STD,pune,,78000,,scooter;Petrol,Engine=109.51 cc,Best seller,,,',
      'two-wheelers,Honda,Activa 6G,DLX,trim=DLX,pune,,81000.50,,automatic,,,,,',
    ].join('\n');

    await importProductsCsv(csv);

    expect(saved.slug).toBe('honda-activa-6g');
    expect(saved.variants.map((v) => v.key)).toEqual(['std', 'dlx']);
    expect(saved.tags).toEqual(['scooter', 'petrol', 'automatic']);
    expect(saved.specs.get('Engine')).toBe('109.51 cc');
    expect(saved.priceByCity.map((p) => [p.variantKey, p.exShowroomPaise])).toEqual([
      ['std', 7800000],
      ['dlx', 8100050],
    ]);
    expect(saved.active).toBe(true); // no review flag → visible
  });

  it('dry run validates without saving', async () => {
    const csv = `${HEADER}\ntwo-wheelers,Honda,Activa 6G,,,pune,,78000,,,,,,,`;
    const report = await importProductsCsv(csv, { dryRun: true });
    expect(report).toMatchObject({
      dryRun: true,
      importedRows: 1,
      productsCreated: 1,
      failedRows: [],
    });
    expect(Product.prototype.save).not.toHaveBeenCalled();
  });

  it('accepts every row of the starter launch catalog, all hidden pending price review', async () => {
    const file = path.join(__dirname, '../../../src/scripts/data/launch-products.csv');
    const saved = [];
    Product.prototype.save.mockImplementation(function captureSave() {
      saved.push(this);
      return Promise.resolve();
    });

    const report = await importProductsCsv(fs.readFileSync(file, 'utf8'));

    expect(report.failedRows).toEqual([]);
    expect(report.productsCreated).toBeGreaterThanOrEqual(300);
    expect(
      saved.every((product) => product.active === false && product.needsPriceReview === true),
    ).toBe(true);
    const activa = saved.find((product) => product.slug === 'honda-activa-6g');
    expect(activa.variants).toHaveLength(3);
  });
});
