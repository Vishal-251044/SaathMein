/**
 * Admin auth routes — /api/admin/auth (ADL-1 to ADL-4).
 */
const { Router } = require('express');
const validate = require('../../middlewares/validate.middleware');
const { requireStaff, requireXhrHeader } = require('../../middlewares/staffAuth.middleware');
const { createRateLimiter } = require('../../middlewares/rateLimit.middleware');
const controller = require('../../controllers/admin/adminAuth.controller');
const schemas = require('../../validators/auth.validator');

const router = Router();

// Per-IP guard; per-account lockout (5 failures → 15 min) is in the staff auth service
const staffLoginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Too many login attempts from this network. Please try again later.',
});

router.post('/login', staffLoginLimiter, validate(schemas.staffLoginSchema), controller.login);
router.post(
  '/2fa/verify',
  staffLoginLimiter,
  validate(schemas.staffTwoFactorSchema),
  controller.verifyTwoFactor,
);
router.post('/refresh', requireXhrHeader, controller.refresh);
router.post('/logout', requireXhrHeader, controller.logout);
router.get('/me', requireStaff(), controller.getMe);

module.exports = router;
