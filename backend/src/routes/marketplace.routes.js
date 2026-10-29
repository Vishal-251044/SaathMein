/**
 * Buyer-facing dealer routes — GET /api/sellers (public) and POST /api/product-requests.
 */
const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireAuth } = require('../middlewares/auth.middleware');
const controller = require('../controllers/marketplace.controller');
const schemas = require('../validators/seller.validator');

const router = Router();

router.get('/sellers', validate(schemas.publicSellersSchema), controller.listSellers);
router.post(
  '/product-requests',
  requireAuth,
  validate(schemas.productRequestSchema),
  controller.requestProduct,
);

module.exports = router;
