/**
 * Buyer purchase routes — /api/purchases (invoice upload, PUR-2) and /api/reviews (TRU-2).
 * Both need a logged-in buyer; services check the purchase belongs to them.
 */
const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireAuth } = require('../middlewares/auth.middleware');
const controller = require('../controllers/purchase.controller');
const schemas = require('../validators/purchase.validator');

const purchaseRouter = Router();
purchaseRouter.use(requireAuth);
purchaseRouter.post(
  '/:purchaseId/invoice/upload-params',
  validate(schemas.invoiceUploadParamsSchema),
  controller.invoiceUploadParams,
);
purchaseRouter.post(
  '/:purchaseId/invoice',
  validate(schemas.submitInvoiceSchema),
  controller.submitInvoice,
);

const reviewRouter = Router();
reviewRouter.post('/', requireAuth, validate(schemas.createReviewSchema), controller.createReview);

module.exports = { purchaseRouter, reviewRouter };
