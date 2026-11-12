/**
 * Admin curation and settings routes — /api/admin/curation, /api/admin/settings (F34, F35).
 * Allowed: Owner and Admin only (PRD §8.2). Everyone else gets 403.
 */
const { Router } = require('express');
const validate = require('../../middlewares/validate.middleware');
const { requireStaff } = require('../../middlewares/staffAuth.middleware');
const controller = require('../../controllers/admin/adminDiscovery.controller');
const schemas = require('../../validators/discovery.validator');
const { STAFF_ROLE } = require('../../constants/enums');

const router = Router();

router.use(['/curation', '/settings'], requireStaff(STAFF_ROLE.ADMIN));

router.get('/curation', validate(schemas.listCurationSchema), controller.listCuration);
router.post('/curation', validate(schemas.createCurationSchema), controller.createCuration);
router.post('/curation/banner-upload-params', controller.bannerUploadParams);
router.patch(
  '/curation/category-order',
  validate(schemas.categoryOrderSchema),
  controller.categoryOrder,
);
router.patch(
  '/curation/:itemId',
  validate(schemas.updateCurationSchema),
  controller.updateCuration,
);
router.delete('/curation/:itemId', validate(schemas.curationIdParams), controller.deleteCuration);

router.get('/settings', controller.getSettings);
// Body is validated per section in the service (different fields per section)
router.patch('/settings/:key', validate(schemas.settingsKeyParams), controller.updateSettings);

module.exports = router;
