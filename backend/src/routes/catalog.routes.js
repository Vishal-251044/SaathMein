/**
 * Catalog routes — public /api/categories, /api/cities and /api/products (browsing works
 * without login; logged-in users get their views and searches remembered).
 */
const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { optionalAuth, requireAuth } = require('../middlewares/auth.middleware');
const controller = require('../controllers/catalog.controller');
const { matchLocationSchema } = require('../validators/city.validator');
const schemas = require('../validators/catalog.validator');

const router = Router();

router.get('/categories', controller.getCategories);
router.get('/cities', controller.getCities);
router.get('/cities/match', validate(matchLocationSchema), controller.matchCity);

router.get(
  '/products',
  optionalAuth,
  validate(schemas.listProductsSchema),
  controller.listProducts,
);
router.get(
  '/products/:productId',
  optionalAuth,
  validate(schemas.getProductSchema),
  controller.getProduct,
);
router.get(
  '/products/:productId/price-history',
  validate(schemas.priceHistorySchema),
  controller.getPriceHistory,
);
router.post(
  '/products/:productId/interest',
  requireAuth,
  validate({ params: schemas.productParams }),
  controller.registerInterest,
);

module.exports = router;
