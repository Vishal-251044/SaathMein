/**
 * Buyer-facing dealer routes — GET /api/sellers (public) and POST /api/product-requests.
 */
const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireAuth } = require('../middlewares/auth.middleware');
const controller = require('../controllers/marketplace.controller');
const schemas = require('../validators/seller.validator');
const trustSchemas = require('../validators/trust.validator');
const trustController = require('../controllers/trust.controller');

const router = Router();

router.get('/sellers', validate(schemas.publicSellersSchema), controller.listSellers);
// Dealer profile and reviews (TRU-2)
router.get(
  '/sellers/:sellerId',
  validate(trustSchemas.sellerIdParams),
  trustController.sellerProfile,
);
router.get(
  '/sellers/:sellerId/reviews',
  validate(trustSchemas.sellerReviewsSchema),
  trustController.sellerReviews,
);
router.post(
  '/product-requests',
  requireAuth,
  validate(schemas.productRequestSchema),
  controller.requestProduct,
);

module.exports = router;
