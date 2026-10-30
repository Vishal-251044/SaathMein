/**
 * Group routes — /api/groups (PRD §12.3 Groups). Browsing public groups works without
 * login; creating, My Groups, codes and leader actions need a logged-in buyer.
 * Join / leave / waitlist arrive with payments on Day 7.
 */
const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { optionalAuth, requireAuth } = require('../middlewares/auth.middleware');
const { createRateLimiter } = require('../middlewares/rateLimit.middleware');
const controller = require('../controllers/group.controller');
const schemas = require('../validators/group.validator');

const router = Router();

// Guessing invite codes must be slow
const codeLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  message: 'Too many invite code attempts. Please wait a few minutes.',
});

router.get('/', optionalAuth, validate(schemas.listGroupsSchema), controller.listGroups);
router.post('/', requireAuth, validate(schemas.createGroupSchema), controller.createGroup);
router.get(
  '/similar',
  requireAuth,
  validate(schemas.similarGroupsSchema),
  controller.similarGroups,
);
router.get('/mine', requireAuth, validate(schemas.myGroupsSchema), controller.myGroups);
router.post(
  '/join-by-code',
  requireAuth,
  codeLimiter,
  validate(schemas.joinByCodeSchema),
  controller.joinByCode,
);

router.get('/:groupId', optionalAuth, validate(schemas.getGroupSchema), controller.getGroup);
router.post(
  '/:groupId/extend',
  requireAuth,
  validate({ params: schemas.groupIdParams }),
  controller.extendDeadline,
);
router.post(
  '/:groupId/start-auction',
  requireAuth,
  validate({ params: schemas.groupIdParams }),
  controller.startAuctionEarly,
);
router.post(
  '/:groupId/cancel',
  requireAuth,
  validate({ params: schemas.groupIdParams }),
  controller.cancelGroup,
);
router.get(
  '/:groupId/requests',
  requireAuth,
  validate({ params: schemas.groupIdParams }),
  controller.listRequests,
);
router.post(
  '/:groupId/requests/:userId',
  requireAuth,
  validate(schemas.decideRequestSchema),
  controller.decideRequest,
);

module.exports = router;
