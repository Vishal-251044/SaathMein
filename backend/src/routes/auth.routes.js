/**
 * App auth routes — /api/auth (buyer phone OTP login ACC-1, Google sign-in F4).
 */
const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireAuth } = require('../middlewares/auth.middleware');
const { createRateLimiter } = require('../middlewares/rateLimit.middleware');
const controller = require('../controllers/auth.controller');
const schemas = require('../validators/auth.validator');

const router = Router();

// Per-IP guard on login attempts (per-phone OTP limits live in the auth service)
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: 'Too many login attempts. Please try again in a few minutes.',
});

router.post(
  '/otp/request',
  loginLimiter,
  validate(schemas.otpRequestSchema),
  controller.requestOtp,
);
router.post('/otp/verify', loginLimiter, validate(schemas.otpVerifySchema), controller.verifyOtp);
router.post('/google', loginLimiter, validate(schemas.googleLoginSchema), controller.verifyGoogle);
router.post('/refresh', validate(schemas.refreshSchema), controller.refresh);
router.post('/logout', validate(schemas.refreshSchema), controller.logout);
router.get('/me', requireAuth, controller.getMe);

module.exports = router;
