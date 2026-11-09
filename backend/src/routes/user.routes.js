/**
 * User routes — /api/users (the logged-in user's own profile, PRD §10.1).
 */
const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireAuth } = require('../middlewares/auth.middleware');
const controller = require('../controllers/user.controller');
const purchaseController = require('../controllers/purchase.controller');
const schemas = require('../validators/user.validator');

const router = Router();

router.use(requireAuth);

router.get('/me', controller.getMe);
// My deal codes (PRD §12.3 GET /me/deal-codes)
router.get('/me/deal-codes', purchaseController.myDealCodes);
router.patch('/me', validate(schemas.updateProfileSchema), controller.updateMe);
router.delete('/me', controller.deleteMe);
router.post('/me/interests', validate(schemas.saveInterestsSchema), controller.saveInterests);
router.post('/me/avatar/upload-params', controller.getAvatarUploadParams);
router.put('/me/avatar', validate(schemas.setAvatarSchema), controller.setAvatar);
router.delete('/me/avatar', controller.removeAvatar);

module.exports = router;
