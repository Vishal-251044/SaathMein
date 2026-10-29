/**
 * Public product queries (CAT-2, DIS-2): list and search active products, product details
 * with the buyer's city prices, and price history.
 */
const Product = require('../../models/product.model');
const City = require('../../models/city.model');
const ApiError = require('../../utils/ApiError');
const { getPagination } = require('../../helpers/genericFunctions');
const { searchProductIds } = require('./productSearch.service');
const { toProductCard, toPublicProduct } = require('./productPresenter');
const { getPriceHistory } = require('./priceHistory.service');

const DEFAULT_CITY_CACHE_MS = 5 * 60 * 1000;
let defaultCityCache = null;

/**
 * The city to show prices for: the requested one, or the first active city (Pune at launch).
 * @param {string} [cityId] - Requested city id
 * @returns {Promise<string|null>} City id
 */
const resolveCityId = async (cityId) => {
  if (cityId) return String(cityId);
  if (!defaultCityCache || Date.now() - defaultCityCache.loadedAt > DEFAULT_CITY_CACHE_MS) {
    const city = await City.findOne({ active: true }).sort({ createdAt: 1 }).select('_id').lean();
    defaultCityCache = { loadedAt: Date.now(), cityId: city ? String(city._id) : null };
  }
  return defaultCityCache.cityId;
};

/**
 * Fetch products by id, keeping the given order.
 * @param {string[]} ids - Product ids (ranked)
 * @returns {Promise<Object[]>} Lean products
 */
const findInOrder = async (ids) => {
  if (!ids.length) return [];
  const products = await Product.find({ _id: { $in: ids }, active: true }).lean();
  const byId = new Map(products.map((product) => [String(product._id), product]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
};

/**
 * List or search active products.
 * @param {{ q?: string, categoryId?: string, cityId?: string, page?: string, limit?: string }} query
 * @returns {Promise<{ products: Object[], meta: Object }>} Cards + pagination
 */
const listProducts = async ({ q, categoryId, cityId, page, limit }) => {
  const pagination = getPagination({ page, limit });
  const resolvedCityId = await resolveCityId(cityId);
  const term = q?.trim();

  let products;
  let hasNextPage;
  let engine;

  if (term) {
    const result = await searchProductIds({
      q: term,
      categoryId,
      skip: pagination.skip,
      limit: pagination.limit,
    });
    products = await findInOrder(result.ids);
    hasNextPage = result.hasNextPage;
    engine = result.engine;
  } else {
    const filter = { active: true, ...(categoryId ? { categoryId } : {}) };
    const found = await Product.find(filter)
      .sort({ brand: 1, model: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit + 1)
      .lean();
    hasNextPage = found.length > pagination.limit;
    products = found.slice(0, pagination.limit);
  }

  return {
    products: products.map((product) => toProductCard(product, resolvedCityId)),
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      hasNextPage,
      cityId: resolvedCityId,
      ...(engine ? { searchEngine: engine } : {}),
    },
  };
};

/**
 * Product page data.
 * @param {string} productId - Product id
 * @param {string} [cityId] - Buyer's city
 * @returns {Promise<Object>} Public product with city prices
 * @throws {ApiError} 404 when missing or inactive
 */
const getProduct = async (productId, cityId) => {
  const product = await Product.findOne({ _id: productId, active: true }).lean();
  if (!product) throw ApiError.notFound('This product is not available');
  return toPublicProduct(product, await resolveCityId(cityId));
};

/**
 * Price history of an active product in a city.
 * @param {string} productId - Product id
 * @param {{ cityId?: string, variantKey?: string }} query
 * @returns {Promise<{ cityId: string|null, points: Object[] }>}
 */
const getProductPriceHistory = async (productId, { cityId, variantKey }) => {
  const exists = await Product.exists({ _id: productId, active: true });
  if (!exists) throw ApiError.notFound('This product is not available');
  const resolvedCityId = await resolveCityId(cityId);
  if (!resolvedCityId) return { cityId: null, points: [] };
  const points = await getPriceHistory({ productId, cityId: resolvedCityId, variantKey });
  return { cityId: resolvedCityId, points };
};

module.exports = { resolveCityId, listProducts, getProduct, getProductPriceHistory };
