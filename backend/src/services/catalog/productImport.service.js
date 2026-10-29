/**
 * Product CSV import (CAT-3): bulk create/update products, variants and city prices,
 * with a per-row error report. Valid rows are imported even when other rows fail.
 *
 * One row = one product (optionally one variant) with (optionally) one city price.
 * Rows with the same brand + model are merged into one product.
 *
 * Columns (header names are case-insensitive; only category, brand, model are required):
 *   category      sub-category slug, e.g. two-wheelers
 *   brand, model  e.g. Honda, Activa 6G
 *   variant       variant name, e.g. "DLX" (empty = whole-product price)
 *   variant_attrs "colour=Pearl White;trim=DLX"
 *   city          city slug, e.g. pune (needed when a price is given)
 *   mrp, ex_showroom, on_road   prices in RUPEES, e.g. 81500 or "81,500"
 *   tags          "scooter;automatic"
 *   specs         "Engine=109.51 cc;Mileage=50 kmpl"
 *   description   free text
 *   image_urls    https URLs separated by "|"
 *   active        true/false (default: false when needs_review is true, else true)
 *   needs_review  true/false — prices not verified yet
 */
const Product = require('../../models/product.model');
const Category = require('../../models/category.model');
const City = require('../../models/city.model');
const ApiError = require('../../utils/ApiError');
const { parseCsvWithHeader, toCsv } = require('../../utils/csv');
const { rupeesToPaise } = require('../../utils/money');
const { slugify } = require('../../helpers/genericFunctions');
const { createLogger } = require('../../utils/logger');
const { recordPriceChanges, priceKey } = require('./priceHistory.service');
const { invalidateSearchCache } = require('./productSearch.service');

const log = createLogger('ProductImport');

const REQUIRED_COLUMNS = ['category', 'brand', 'model'];
const KNOWN_COLUMNS = [
  ...REQUIRED_COLUMNS,
  'variant',
  'variant_attrs',
  'city',
  'mrp',
  'ex_showroom',
  'on_road',
  'tags',
  'specs',
  'description',
  'image_urls',
  'active',
  'needs_review',
];
const MAX_ROWS = 5000;
const MAX_IMAGES = 10;
const PRICE_COLUMNS = { mrp: 'mrpPaise', ex_showroom: 'exShowroomPaise', on_road: 'onRoadPaise' };

/**
 * Parse "key=value;key2=value2".
 * @param {string} text - Raw cell
 * @returns {Record<string, string>} Pairs (empty object for empty text)
 * @throws {Error} For a pair without "="
 */
const parsePairs = (text) => {
  if (!text) return {};
  return Object.fromEntries(
    text
      .split(';')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const index = pair.indexOf('=');
        if (index <= 0) throw new Error(`"${pair}" must look like Key=Value`);
        return [pair.slice(0, index).trim(), pair.slice(index + 1).trim()];
      }),
  );
};

/**
 * Parse a yes/no cell.
 * @param {string} text - Raw cell
 * @returns {boolean|undefined} undefined when empty
 * @throws {Error} For anything else
 */
const parseBoolean = (text) => {
  if (!text) return undefined;
  const value = text.toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(value)) return true;
  if (['false', 'no', 'n', '0'].includes(value)) return false;
  throw new Error(`"${text}" must be true or false`);
};

/**
 * Validate one CSV row and convert it to import data.
 * @param {Record<string, string>} values - Cells by column
 * @param {{ categories: Map, leafIds: Set, cities: Map }} lookups - Reference data
 * @returns {{ errors: string[], data?: Object }}
 */
const parseRow = (values, { categories, leafIds, cities }) => {
  const errors = [];
  const attempt = (label, fn) => {
    try {
      return fn();
    } catch (err) {
      errors.push(`${label}: ${err.message}`);
      return undefined;
    }
  };

  const category = categories.get(values.category?.toLowerCase());
  if (!values.category) errors.push('category is required');
  else if (!category) errors.push(`category "${values.category}" does not exist`);
  else if (!leafIds.has(String(category._id)))
    errors.push(`category "${values.category}" has sub-categories; use one of those`);

  if (!values.brand) errors.push('brand is required');
  if (!values.model) errors.push('model is required');
  if (values.brand?.length > 60) errors.push('brand is longer than 60 characters');
  if (values.model?.length > 120) errors.push('model is longer than 120 characters');

  const prices = {};
  Object.entries(PRICE_COLUMNS).forEach(([column, field]) => {
    if (!values[column]) return;
    const paise = attempt(column, () => rupeesToPaise(values[column]));
    if (paise !== undefined && paise <= 0) errors.push(`${column} must be more than 0`);
    else if (paise !== undefined) prices[field] = paise;
  });
  const hasPrice = Object.keys(prices).length > 0;

  const city = values.city ? cities.get(values.city.toLowerCase()) : null;
  if (values.city && !city) errors.push(`city "${values.city}" does not exist`);
  if (hasPrice && !values.city) errors.push('city is required when a price is given');
  if (values.city && !hasPrice)
    errors.push('city is given but no mrp, ex_showroom or on_road price');

  const variantAttrs = attempt('variant_attrs', () => parsePairs(values.variant_attrs));
  const specs = attempt('specs', () => parsePairs(values.specs));
  const active = attempt('active', () => parseBoolean(values.active));
  const needsReview = attempt('needs_review', () => parseBoolean(values.needs_review));

  const imageUrls = values.image_urls
    ? values.image_urls
        .split('|')
        .map((url) => url.trim())
        .filter(Boolean)
    : [];
  imageUrls.forEach((url) => {
    if (!/^https:\/\/[^\s]+$/i.test(url))
      errors.push(`image URL must start with https:// ("${url}")`);
  });
  if (imageUrls.length > MAX_IMAGES) errors.push(`at most ${MAX_IMAGES} images per row`);

  if (errors.length) return { errors };

  const variantKey = values.variant ? slugify(values.variant) : null;
  return {
    errors,
    data: {
      slug: slugify(`${values.brand} ${values.model}`),
      categoryId: String(category._id),
      brand: values.brand,
      model: values.model,
      variant: values.variant
        ? { key: variantKey, name: values.variant, attrs: variantAttrs }
        : null,
      price: hasPrice ? { cityId: String(city._id), variantKey, ...prices } : null,
      tags: values.tags
        ? values.tags
            .split(';')
            .map((tag) => tag.trim().toLowerCase())
            .filter(Boolean)
        : [],
      specs,
      description: values.description || undefined,
      imageUrls,
      active,
      needsReview,
    },
  };
};

/**
 * Merge a group of valid rows (same product) into one product document.
 * @param {Object|null} existing - Product document already in the database
 * @param {Object[]} rows - Parsed rows for this product
 * @returns {{ product: Object, oldPrices: Object[] }}
 */
const mergeIntoProduct = (existing, rows) => {
  const product =
    existing ||
    new Product({ slug: rows[0].slug, variants: [], priceByCity: [], images: [], tags: [] });
  const oldPrices = (product.priceByCity || []).map((entry) => entry.toObject());

  product.categoryId = rows[0].categoryId;
  product.brand = rows[0].brand;
  product.model = rows[0].model;

  const tags = new Set(product.tags || []);
  const specs = new Map(product.specs || []);
  const variants = new Map((product.variants || []).map((v) => [v.key, v.toObject()]));
  const prices = new Map((product.priceByCity || []).map((p) => [priceKey(p), p.toObject()]));
  const imageUrls = new Set((product.images || []).map((image) => image.url));
  const now = new Date();

  rows.forEach((row) => {
    row.tags.forEach((tag) => tags.add(tag));
    Object.entries(row.specs).forEach(([key, value]) => specs.set(key, value));
    if (row.description) product.description = row.description;
    if (row.variant) {
      const current = variants.get(row.variant.key);
      variants.set(row.variant.key, {
        key: row.variant.key,
        name: row.variant.name,
        attrs: {
          ...(current?.attrs instanceof Map ? Object.fromEntries(current.attrs) : current?.attrs),
          ...row.variant.attrs,
        },
      });
    }
    if (row.price) prices.set(priceKey(row.price), { ...row.price, updatedAt: now });
    row.imageUrls.forEach((url) => {
      if (!imageUrls.has(url) && imageUrls.size < MAX_IMAGES) {
        imageUrls.add(url);
        product.images.push({ url });
      }
    });
  });

  product.tags = [...tags];
  product.specs = Object.fromEntries(specs);
  product.variants = [...variants.values()];
  product.priceByCity = [...prices.values()];

  // Last explicit value wins; new products default to hidden when prices need review
  const needsReview = rows
    .map((row) => row.needsReview)
    .filter((value) => value !== undefined)
    .at(-1);
  const active = rows
    .map((row) => row.active)
    .filter((value) => value !== undefined)
    .at(-1);
  if (needsReview !== undefined) product.needsPriceReview = needsReview;
  if (active !== undefined) product.active = active;
  else if (!existing) product.active = !product.needsPriceReview;

  return { product, oldPrices };
};

/**
 * Import products from CSV text.
 * @param {string} csvText - File contents
 * @param {{ dryRun?: boolean, staffUserId?: string }} [options] - dryRun = validate only
 * @returns {Promise<Object>} Report: rows, failed rows with reasons, products created/updated, prices changed
 * @throws {ApiError} 422 for a missing header, unknown columns or too many rows
 */
const importProductsCsv = async (csvText, { dryRun = false, staffUserId } = {}) => {
  let parsed;
  try {
    parsed = parseCsvWithHeader(csvText);
  } catch (err) {
    throw new ApiError(422, `The file is not valid CSV: ${err.message}`, { code: 'INVALID_CSV' });
  }
  const { headers, records } = parsed;

  const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length) {
    throw new ApiError(422, `Missing columns: ${missing.join(', ')}`, { code: 'INVALID_CSV' });
  }
  const unknown = headers.filter((header) => header && !KNOWN_COLUMNS.includes(header));
  if (unknown.length) {
    throw new ApiError(422, `Unknown columns: ${unknown.join(', ')}`, { code: 'INVALID_CSV' });
  }
  if (records.length === 0)
    throw new ApiError(422, 'The file has no product rows', { code: 'INVALID_CSV' });
  if (records.length > MAX_ROWS) {
    throw new ApiError(422, `At most ${MAX_ROWS} rows per file (this one has ${records.length})`, {
      code: 'INVALID_CSV',
    });
  }

  const [categoryDocs, cityDocs] = await Promise.all([Category.find().lean(), City.find().lean()]);
  const parentIds = new Set(categoryDocs.filter((c) => c.parentId).map((c) => String(c.parentId)));
  const lookups = {
    categories: new Map(categoryDocs.map((c) => [c.slug, c])),
    leafIds: new Set(
      categoryDocs.filter((c) => !parentIds.has(String(c._id))).map((c) => String(c._id)),
    ),
    cities: new Map(cityDocs.map((c) => [c.slug, c])),
  };

  const failedRows = [];
  const groups = new Map(); // slug → [{ rowNumber, data }]
  records.forEach(({ rowNumber, values }) => {
    const { errors, data } = parseRow(values, lookups);
    if (errors.length) {
      failedRows.push({ row: rowNumber, errors });
      return;
    }
    const group = groups.get(data.slug) || [];
    if (group.length && group[0].data.categoryId !== data.categoryId) {
      failedRows.push({
        row: rowNumber,
        errors: [`category differs from row ${group[0].rowNumber} for the same product`],
      });
      return;
    }
    group.push({ rowNumber, data });
    groups.set(data.slug, group);
  });

  const existingProducts = await Product.find({ slug: { $in: [...groups.keys()] } });
  const existingBySlug = new Map(existingProducts.map((product) => [product.slug, product]));

  let productsCreated = 0;
  let productsUpdated = 0;
  let pricesChanged = 0;
  let importedRows = 0;

  for (const [slug, group] of groups) {
    const existing = existingBySlug.get(slug) || null;
    const { product, oldPrices } = mergeIntoProduct(
      existing,
      group.map((entry) => entry.data),
    );

    try {
      await product.validate();
      if (!dryRun) {
        await product.save();
        pricesChanged += await recordPriceChanges({
          productId: product._id,
          oldPrices,
          newPrices: product.priceByCity.map((entry) => entry.toObject()),
          source: 'admin',
          changedBy: staffUserId,
        });
      }
      existing ? (productsUpdated += 1) : (productsCreated += 1);
      importedRows += group.length;
    } catch (err) {
      const message = err?.errors
        ? Object.values(err.errors)
            .map((e) => e.message)
            .join('; ')
        : err.message;
      group.forEach(({ rowNumber }) => failedRows.push({ row: rowNumber, errors: [message] }));
    }
  }

  if (!dryRun) invalidateSearchCache();
  failedRows.sort((a, b) => a.row - b.row);
  const report = {
    dryRun,
    totalRows: records.length,
    importedRows,
    failedRows,
    productsCreated,
    productsUpdated,
    pricesChanged,
  };
  log.info({ ...report, failedRows: failedRows.length, staffUserId }, 'Product import finished');
  return report;
};

/** @returns {string} Template CSV with the header and two example rows */
const getImportTemplateCsv = () =>
  toCsv([
    KNOWN_COLUMNS,
    [
      'two-wheelers',
      'Honda',
      'Activa 6G',
      'STD',
      'trim=STD',
      'pune',
      '',
      '78000',
      '',
      'scooter;automatic',
      'Engine=109.51 cc',
      'Popular 110 cc scooter',
      '',
      'false',
      'true',
    ],
    [
      'two-wheelers',
      'Honda',
      'Activa 6G',
      'DLX',
      'trim=DLX',
      'pune',
      '',
      '81000',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ],
  ]);

module.exports = { importProductsCsv, getImportTemplateCsv, parseRow, KNOWN_COLUMNS, MAX_ROWS };
