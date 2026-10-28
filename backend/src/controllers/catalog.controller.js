/**
 * Catalog controller — public categories and cities (products arrive on Day 4).
 */
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const { getActiveCategoryTree } = require('../services/category.service');
const { listActiveCities, matchLocation } = require('../services/city.service');

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

module.exports = { getCategories, getCities, matchCity };
