/**
 * Admin cities controller — /api/admin/cities (Admin, Deal Manager, Owner).
 */
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/ApiResponse');
const cityService = require('../../services/city.service');

/** GET /api/admin/cities */
const listCities = asyncHandler(async (req, res) => {
  const cities = await cityService.listAllCities();
  return sendSuccess(res, { message: 'Cities fetched', data: { cities } });
});

/** POST /api/admin/cities */
const createCity = asyncHandler(async (req, res) => {
  const city = await cityService.createCity(req.body);
  return sendSuccess(res, { statusCode: 201, message: 'City created', data: { city } });
});

/** PATCH /api/admin/cities/:cityId */
const updateCity = asyncHandler(async (req, res) => {
  const city = await cityService.updateCity(req.params.cityId, req.body);
  return sendSuccess(res, { message: 'City updated', data: { city } });
});

/** POST /api/admin/cities/:cityId/areas */
const addArea = asyncHandler(async (req, res) => {
  const city = await cityService.addArea(req.params.cityId, req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Area added', data: { city } });
});

/** PATCH /api/admin/cities/:cityId/areas/:areaId */
const updateArea = asyncHandler(async (req, res) => {
  const city = await cityService.updateArea(req.params.cityId, req.params.areaId, req.body);
  return sendSuccess(res, { message: 'Area updated', data: { city } });
});

module.exports = { listCities, createCity, updateCity, addArea, updateArea };
