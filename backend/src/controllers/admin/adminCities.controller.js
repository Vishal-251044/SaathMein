/**
 * Admin cities controller — /api/admin/cities (Admin, Deal Manager, Owner).
 * Every write describes itself for the audit log (ADL-5).
 */
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/ApiResponse');
const { setAudit, diffSnapshots } = require('../../services/audit.service');
const cityService = require('../../services/city.service');

/** GET /api/admin/cities */
const listCities = asyncHandler(async (req, res) => {
  const cities = await cityService.listAllCities();
  return sendSuccess(res, { message: 'Cities fetched', data: { cities } });
});

/** POST /api/admin/cities */
const createCity = asyncHandler(async (req, res) => {
  const city = await cityService.createCity(req.body);
  setAudit(req, { action: 'city.create', targetType: 'city', targetId: city.id, after: city });
  return sendSuccess(res, { statusCode: 201, message: 'City created', data: { city } });
});

/** PATCH /api/admin/cities/:cityId */
const updateCity = asyncHandler(async (req, res) => {
  const before = await cityService.getAdminCity(req.params.cityId);
  const city = await cityService.updateCity(req.params.cityId, req.body);
  setAudit(req, {
    action: 'city.update',
    targetType: 'city',
    targetId: city.id,
    ...diffSnapshots(before, city),
  });
  return sendSuccess(res, { message: 'City updated', data: { city } });
});

/** POST /api/admin/cities/:cityId/areas */
const addArea = asyncHandler(async (req, res) => {
  const city = await cityService.addArea(req.params.cityId, req.body);
  setAudit(req, {
    action: 'city.area.create',
    targetType: 'city',
    targetId: city.id,
    after: req.body,
  });
  return sendSuccess(res, { statusCode: 201, message: 'Area added', data: { city } });
});

/** PATCH /api/admin/cities/:cityId/areas/:areaId */
const updateArea = asyncHandler(async (req, res) => {
  const before = await cityService.getAdminCity(req.params.cityId);
  const city = await cityService.updateArea(req.params.cityId, req.params.areaId, req.body);
  const findArea = (snapshot) =>
    snapshot.areas?.find((area) => String(area.id) === req.params.areaId) ?? null;
  setAudit(req, {
    action: 'city.area.update',
    targetType: 'city',
    targetId: city.id,
    ...diffSnapshots(findArea(before), findArea(city)),
  });
  return sendSuccess(res, { message: 'Area updated', data: { city } });
});

module.exports = { listCities, createCity, updateCity, addArea, updateArea };
