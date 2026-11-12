/**
 * Buyer trust routes — /api/reports (TRU-3) and /api/disputes (TRU-4). Logged-in users;
 * services check the buyer owns the purchase and can see what they report.
 */
const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireAuth } = require('../middlewares/auth.middleware');
const { createRateLimiter } = require('../middlewares/rateLimit.middleware');
const controller = require('../controllers/trust.controller');
const schemas = require('../validators/trust.validator');

// Reports and disputes are cheap to send: keep them from being used for spam
const trustLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  message: 'Too many reports. Please try again later.',
});

const reportRouter = Router();
reportRouter.post(
  '/',
  requireAuth,
  trustLimiter,
  validate(schemas.createReportSchema),
  controller.createReport,
);

const disputeRouter = Router();
disputeRouter.use(requireAuth);
disputeRouter.post('/evidence-upload-params', controller.buyerEvidenceParams);
disputeRouter.post('/', trustLimiter, validate(schemas.openDisputeSchema), controller.openDispute);
disputeRouter.get('/', validate(schemas.myDisputesSchema), controller.myDisputes);
disputeRouter.get('/:disputeId', validate(schemas.disputeIdParams), controller.myDispute);

module.exports = { reportRouter, disputeRouter };
