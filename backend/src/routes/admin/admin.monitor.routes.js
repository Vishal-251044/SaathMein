/**
 * Admin monitor routes — /api/admin/monitor/* and /api/admin/alerts (PRD §10.11, §8.2).
 * Permission matrix (the Owner passes every check):
 *   overview, alerts ............ every staff role
 *   groups, auctions (view) ..... Admin, Deal Manager, Support
 *   auction / group actions ..... Admin, Deal Manager
 *   payments (view + actions) ... Admin, Finance            (Support → 403)
 *   dealers (view) .............. Admin, Deal Manager, Support; penalties: Admin, Deal Manager
 *   buyers (view + suspend) ..... Admin, Support
 *   disputes SLA ................ Admin, Support
 *   system health ............... Admin
 * Guards are scoped by path because this router is mounted at /api/admin.
 */
const { Router } = require('express');
const validate = require('../../middlewares/validate.middleware');
const { requireStaff } = require('../../middlewares/staffAuth.middleware');
const controller = require('../../controllers/admin/adminMonitor.controller');
const alertController = require('../../controllers/admin/adminTeam.controller');
const schemas = require('../../validators/monitor.validator');
const { STAFF_ROLE: R } = require('../../constants/enums');

const router = Router();

const ops = requireStaff(R.ADMIN, R.DEAL_MANAGER);
const opsView = requireStaff(R.ADMIN, R.DEAL_MANAGER, R.SUPPORT);
const finance = requireStaff(R.ADMIN, R.FINANCE);
const support = requireStaff(R.ADMIN, R.SUPPORT);
const admin = requireStaff(R.ADMIN);

// Everyone on the staff
router.get('/monitor/overview', validate(schemas.overviewSchema), controller.getOverview);
router.get('/alerts', validate(schemas.alertsSchema), alertController.listAlerts);
router.patch('/alerts/:alertId', validate(schemas.alertActionSchema), alertController.updateAlert);

// Groups + auctions
router.get('/monitor/groups', opsView, validate(schemas.overviewSchema), controller.getGroups);
router.get('/monitor/auctions', opsView, validate(schemas.auctionsSchema), controller.listAuctions);
router.get(
  '/monitor/auctions/:groupId',
  opsView,
  validate(schemas.groupIdSchema),
  controller.getAuction,
);
router.post(
  '/monitor/auctions/:groupId/pause',
  ops,
  validate(schemas.auctionReasonSchema),
  controller.pauseAuction,
);
router.post(
  '/monitor/auctions/:groupId/resume',
  ops,
  validate(schemas.auctionReasonSchema),
  controller.resumeAuction,
);
router.post(
  '/monitor/auctions/:groupId/extend',
  ops,
  validate(schemas.extendAuctionSchema),
  controller.extendAuction,
);
router.post(
  '/monitor/auctions/:groupId/runner-up',
  ops,
  validate(schemas.forceRunnerUpSchema),
  controller.forceRunnerUp,
);
router.post(
  '/monitor/groups/:groupId/cancel',
  ops,
  validate(schemas.auctionReasonSchema),
  controller.cancelGroup,
);
router.post(
  '/monitor/groups/:groupId/extend',
  ops,
  validate(schemas.extendGroupSchema),
  controller.extendGroup,
);

// Payments (Razorpay) — money: Admin / Finance only
router.get(
  '/monitor/payments/summary',
  finance,
  validate(schemas.paymentMonitorSchema),
  controller.getPaymentSummary,
);
router.get('/monitor/payments', finance, validate(schemas.paymentsSchema), controller.listPayments);
router.post(
  '/monitor/payments/:paymentId/retry-refund',
  finance,
  validate(schemas.paymentReasonSchema),
  controller.retryRefund,
);
router.post(
  '/monitor/payments/:paymentId/refund',
  finance,
  validate(schemas.manualRefundSchema),
  controller.manualRefund,
);
router.post(
  '/monitor/payments/:paymentId/release-hold',
  finance,
  validate(schemas.paymentReasonSchema),
  controller.releaseHold,
);
router.post(
  '/monitor/payments/:paymentId/reverse-hold',
  finance,
  validate(schemas.paymentReasonSchema),
  controller.reverseHold,
);

// Dealers
router.get('/monitor/dealers', opsView, validate(schemas.dealersSchema), controller.listDealers);
router.post(
  '/monitor/dealers/:sellerId/penalties',
  ops,
  validate(schemas.penaliseDealerSchema),
  controller.penaliseDealer,
);
router.post(
  '/monitor/dealers/:sellerId/penalties/:penaltyId/lift',
  ops,
  validate(schemas.liftPenaltySchema),
  controller.liftPenalty,
);

// Buyers + disputes
router.get('/monitor/buyers', support, validate(schemas.buyersSchema), controller.getBuyers);
router.post(
  '/monitor/buyers/:userId/status',
  support,
  validate(schemas.buyerStatusSchema),
  controller.setBuyerStatus,
);
router.get('/monitor/disputes', support, controller.getDisputes);

// System
router.get('/monitor/system', admin, controller.getSystem);
router.post(
  '/monitor/system/queues/:queue/retry',
  admin,
  validate(schemas.retryJobsSchema),
  controller.retryJobs,
);

module.exports = router;
