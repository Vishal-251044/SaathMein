/**
 * Catalog controller — public categories, cities and products (CAT-2, DIS-2).
 * Views and searches by logged-in users are recorded as demand signals (AI, Days 16–19).
 */
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const { getActiveCategoryTree } = require('../services/category.service');
const { listActiveCities, matchLocation } = require('../services/city.service');
const productQuery = require('../services/catalog/productQuery.service');
const { recordSignal } = require('../services/demandSignal.service');

/** GET /api/categories — active category tree. */
const getCategories = asyncHandler(async (req, res) => {
  const categories = await getActiveCategoryTree();
  return sendSuccess(res, { message: 'Categories fetched', data: { categories } });
});

/** GET /api/cities — active launch cities with areas. */
const getCities = asyncHandler(async (req, res) => {
  const cities = await listActiveCities();
  return sendSuccess(res, { message: 'Cities fetched', data: { cities } });
});

/** GET /api/cities/match?latitude=&longitude=&pincode= — detect city and area. */
const matchCity = asyncHandler(async (req, res) => {
  const data = await matchLocation(req.validatedQuery);
  return sendSuccess(res, { message: data.city ? 'City found' : 'No launch city here yet', data });
});

/** GET /api/products?q=&categoryId=&cityId=&page=&limit= — list or search. */
const listProducts = asyncHandler(async (req, res) => {
  const query = req.validatedQuery;
  const { products, meta } = await productQuery.listProducts(query);

  // Only the first page of a real search counts as a search signal
  if (req.auth && query.q && (!query.page || query.page === '1')) {
    recordSignal({
      userId: req.auth.userId,
      type: 'search',
      query: query.q.slice(0, 100),
      categoryId: query.categoryId,
      cityId: meta.cityId,
    });
  }
  return sendSuccess(res, { message: 'Products fetched', data: { products }, meta });
});

/** GET /api/products/:productId?cityId= — product page. */
const getProduct = asyncHandler(async (req, res) => {
  const product = await productQuery.getProduct(req.params.productId, req.validatedQuery.cityId);
  if (req.auth) {
    recordSignal({
      userId: req.auth.userId,
      type: 'view',
      productId: product.id,
      categoryId: product.categoryId,
      cityId: product.cityId,
    });
  }
  return sendSuccess(res, { message: 'Product fetched', data: { product } });
});

/** GET /api/products/:productId/price-history?cityId=&variantKey= */
const getPriceHistory = asyncHandler(async (req, res) => {
  const data = await productQuery.getProductPriceHistory(req.params.productId, req.validatedQuery);
  return sendSuccess(res, { message: 'Price history fetched', data });
});

/**
 * POST /api/products/:productId/interest — "I want this" from the product page.
 * Until group creation exists (Day 6) this records demand for demand nudges (SMT-5).
 */
const registerInterest = asyncHandler(async (req, res) => {
  const product = await productQuery.getProduct(req.params.productId, req.body?.cityId);
  await recordSignal({
    userId: req.auth.userId,
    type: 'interest',
    productId: product.id,
    categoryId: product.categoryId,
    cityId: product.cityId,
  });
  return sendSuccess(res, { statusCode: 201, message: 'Interest saved' });
});

module.exports = {
  getCategories,
  getCities,
  matchCity,
  listProducts,
  getProduct,
  getPriceHistory,
  registerInterest,
};
