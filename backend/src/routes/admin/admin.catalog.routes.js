/**
 * Admin catalog routes — /api/admin/categories and /api/admin/products (CAT-1 to CAT-3).
 * Allowed: Owner, Admin, Deal Manager (PRD §8.2).
 */
const express = require('express');
const validate = require('../../middlewares/validate.middleware');
const { requireStaff } = require('../../middlewares/staffAuth.middleware');
const controller = require('../../controllers/admin/adminCatalog.controller');
const schemas = require('../../validators/catalog.validator');
const { STAFF_ROLE } = require('../../constants/enums');

const router = express.Router();

// TODO(Day 5): audit-log middleware on every write below
// Scoped to these paths: this router is mounted at /api/admin, so an unscoped guard would
// also block other staff roles from modules mounted after it
router.use(['/categories', '/products'], requireStaff(STAFF_ROLE.ADMIN, STAFF_ROLE.DEAL_MANAGER));

router.get('/categories', controller.listCategories);
router.post('/categories', validate(schemas.createCategorySchema), controller.createCategory);
router.patch(
  '/categories/:categoryId',
  validate(schemas.updateCategorySchema),
  controller.updateCategory,
);

// CSV import reads the raw file body (up to 5 MB); declared before /:productId routes
router.get('/products/import/template', controller.downloadTemplate);
router.post(
  '/products/import',
  express.text({ type: ['text/csv', 'text/plain', 'application/vnd.ms-excel'], limit: '5mb' }),
  validate(schemas.importProductsSchema),
  controller.importProducts,
);

router.get('/products', validate(schemas.adminListProductsSchema), controller.listProducts);
router.post('/products', validate(schemas.createProductSchema), controller.createProduct);
router.get(
  '/products/:productId',
  validate({ params: schemas.productParams }),
  controller.getProduct,
);
router.patch(
  '/products/:productId',
  validate(schemas.updateProductSchema),
  controller.updateProduct,
);
router.post(
  '/products/:productId/images/upload-params',
  validate({ params: schemas.productParams }),
  controller.getImageUploadParams,
);
router.post(
  '/products/:productId/images',
  validate(schemas.productImageSchema),
  controller.addImage,
);
router.delete(
  '/products/:productId/images',
  validate(schemas.removeProductImageSchema),
  controller.removeImage,
);

module.exports = router;
