/**
 * User routes — /api/users (the logged-in user's own profile, PRD §10.1).
 */
const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireAuth } = require('../middlewares/auth.middleware');
const controller = require('../controllers/user.controller');
const purchaseController = require('../controllers/purchase.controller');
const discoveryController = require('../controllers/discovery.controller');
const discoverySchemas = require('../validators/discovery.validator');
const schemas = require('../validators/user.validator');
const authController = require('../controllers/auth.controller');
const authSchemas = require('../validators/auth.validator');
const { createRateLimiter } = require('../middlewares/rateLimit.middleware');

// Adding a phone verifies an OTP: same per-IP guard as login
const phoneLinkLimiter = createRateLimiter({
  name: 'phone-link',
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Too many attempts. Please try again in a few minutes.',
});

const router = Router();

router.use(requireAuth);

router.get('/me', controller.getMe);
// My deal codes (PRD §12.3 GET /me/deal-codes)
router.get('/me/deal-codes', purchaseController.myDealCodes);
// Wallet and referral (REF-1 to REF-3)
router.get('/me/wallet', validate(discoverySchemas.walletSchema), discoveryController.wallet);
router.get('/me/referral', discoveryController.referral);
router.post(
  '/me/referral',
  validate(discoverySchemas.applyReferralSchema),
  discoveryController.applyReferral,
);
router.patch('/me', validate(schemas.updateProfileSchema), controller.updateMe);
// Google accounts add a verified phone once, before their first token (F4)
router.post(
  '/me/phone',
  phoneLinkLimiter,
  validate(authSchemas.linkPhoneSchema),
  authController.linkPhone,
);
router.delete('/me', controller.deleteMe);
router.post('/me/interests', validate(schemas.saveInterestsSchema), controller.saveInterests);
router.post('/me/avatar/upload-params', controller.getAvatarUploadParams);
router.put('/me/avatar', validate(schemas.setAvatarSchema), controller.setAvatar);
router.delete('/me/avatar', controller.removeAvatar);

module.exports = router;
