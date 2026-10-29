/**
 * Admin city routes — /api/admin/cities (CAT-4). Allowed: Owner, Admin, Deal Manager (PRD §8.2).
 */
const { Router } = require('express');
const validate = require('../../middlewares/validate.middleware');
const { requireStaff } = require('../../middlewares/staffAuth.middleware');
const controller = require('../../controllers/admin/adminCities.controller');
const schemas = require('../../validators/city.validator');
const { STAFF_ROLE } = require('../../constants/enums');

const router = Router();

router.use(requireStaff(STAFF_ROLE.ADMIN, STAFF_ROLE.DEAL_MANAGER));

router.get('/', controller.listCities);
router.post('/', validate(schemas.createCitySchema), controller.createCity);
router.patch('/:cityId', validate(schemas.updateCitySchema), controller.updateCity);
router.post('/:cityId/areas', validate(schemas.addAreaSchema), controller.addArea);
router.patch('/:cityId/areas/:areaId', validate(schemas.updateAreaSchema), controller.updateArea);

module.exports = router;
