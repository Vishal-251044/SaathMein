/**
 * Dealer dashboard routes — /api/seller (PRD §12.3 Seller, §10.10).
 * /auth/* is public (with rate limits and the cookie CSRF guard); everything else needs
 * a logged-in member of a dealer team. Owner-only: profile, KYC, team changes.
 */
const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireSeller, requireSellerOwner } = require('../middlewares/seller.middleware');
const { requireXhrHeader } = require('../middlewares/staffAuth.middleware');
const { createRateLimiter } = require('../middlewares/rateLimit.middleware');
const controller = require('../controllers/seller.controller');
const schemas = require('../validators/seller.validator');

const router = Router();

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Too many attempts from this network. Please try again later.',
});

// Public auth
router.post('/auth/register', authLimiter, validate(schemas.registerSchema), controller.register);
router.post('/auth/login', authLimiter, validate(schemas.loginSchema), controller.login);
router.post('/auth/refresh', requireXhrHeader, controller.refresh);
router.post('/auth/logout', requireXhrHeader, controller.logout);
router.get(
  '/auth/invites/:token',
  authLimiter,
  validate(schemas.inviteTokenParams),
  controller.getInvite,
);
router.post(
  '/auth/invites/accept',
  authLimiter,
  validate(schemas.acceptInviteSchema),
  controller.acceptInvite,
);

// Logged in (email verification also works before KYC)
router.post('/auth/email/send-code', requireAuth, controller.sendEmailCode);
router.post(
  '/auth/email/verify',
  requireAuth,
  authLimiter,
  validate(schemas.verifyEmailSchema),
  controller.verifyEmail,
);

// Dealer team members
router.use(requireAuth, requireSeller);
router.get('/me', controller.getMe);
router.get('/team', controller.getTeam);
router.post('/product-requests', validate(schemas.productRequestSchema), controller.requestProduct);

// Owner only
router.patch(
  '/profile',
  requireSellerOwner,
  validate(schemas.updateProfileSchema),
  controller.updateProfile,
);
router.post(
  '/kyc/upload-params',
  requireSellerOwner,
  validate(schemas.kycUploadParamsSchema),
  controller.getKycUploadParams,
);
router.post('/kyc', requireSellerOwner, validate(schemas.kycSchema), controller.submitKyc);
router.post('/team/invites', requireSellerOwner, validate(schemas.inviteSchema), controller.invite);
router.delete(
  '/team/invites/:inviteId',
  requireSellerOwner,
  validate(schemas.inviteIdParams),
  controller.revokeInvite,
);
router.delete(
  '/team/members/:userId',
  requireSellerOwner,
  validate(schemas.memberIdParams),
  controller.removeMember,
);

module.exports = router;
