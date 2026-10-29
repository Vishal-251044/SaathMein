/**
 * Admin catalog controller — categories with rules, products, images and CSV import
 * (CAT-1 to CAT-3). Owner, Admin and Deal Manager.
 */
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const categoryService = require('../../services/category.service');
const productAdmin = require('../../services/catalog/productAdmin.service');
const productImport = require('../../services/catalog/productImport.service');

/* ----------------------------- Categories ----------------------------- */

/** GET /api/admin/categories */
const listCategories = asyncHandler(async (req, res) => {
  const categories = await categoryService.listAdminCategories();
  return sendSuccess(res, { message: 'Categories fetched', data: { categories } });
});

/** POST /api/admin/categories */
const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Category created', data: { category } });
});

/** PATCH /api/admin/categories/:categoryId */
const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(req.params.categoryId, req.body);
  return sendSuccess(res, { message: 'Category updated', data: { category } });
});

/* ------------------------------ Products ------------------------------ */

/** GET /api/admin/products?q=&categoryId=&status=&page=&limit= */
const listProducts = asyncHandler(async (req, res) => {
  const { products, meta } = await productAdmin.listAdminProducts(req.validatedQuery);
  return sendSuccess(res, { message: 'Products fetched', data: { products }, meta });
});

/** GET /api/admin/products/:productId */
const getProduct = asyncHandler(async (req, res) => {
  const product = await productAdmin.getAdminProduct(req.params.productId);
  return sendSuccess(res, { message: 'Product fetched', data: { product } });
});

/** POST /api/admin/products */
const createProduct = asyncHandler(async (req, res) => {
  const product = await productAdmin.createProduct(req.body, req.staff.userId);
  return sendSuccess(res, { statusCode: 201, message: 'Product created', data: { product } });
});

/** PATCH /api/admin/products/:productId */
const updateProduct = asyncHandler(async (req, res) => {
  const product = await productAdmin.updateProduct(
    req.params.productId,
    req.body,
    req.staff.userId,
  );
  return sendSuccess(res, { message: 'Product updated', data: { product } });
});

/** POST /api/admin/products/:productId/images/upload-params */
const getImageUploadParams = asyncHandler(async (req, res) => {
  const data = await productAdmin.getImageUploadParams(req.params.productId);
  return sendSuccess(res, { message: 'Upload authorised', data });
});

/** POST /api/admin/products/:productId/images — attach a verified upload */
const addImage = asyncHandler(async (req, res) => {
  const product = await productAdmin.addProductImage(req.params.productId, req.body);
  return sendSuccess(res, { message: 'Image added', data: { product } });
});

/** DELETE /api/admin/products/:productId/images?url= */
const removeImage = asyncHandler(async (req, res) => {
  const product = await productAdmin.removeProductImage(
    req.params.productId,
    req.validatedQuery.url,
  );
  return sendSuccess(res, { message: 'Image removed', data: { product } });
});

/* ---------------------------- CSV import ---------------------------- */

/** POST /api/admin/products/import?dryRun=true (body: text/csv) */
const importProducts = asyncHandler(async (req, res) => {
  if (typeof req.body !== 'string' || !req.body.trim()) {
    throw ApiError.badRequest('Send the CSV file as the request body (Content-Type: text/csv)', {
      code: 'INVALID_CSV',
    });
  }
  const report = await productImport.importProductsCsv(req.body, {
    dryRun: req.validatedQuery.dryRun === 'true',
    staffUserId: req.staff.userId,
  });
  const message = report.dryRun ? 'Check finished — nothing was saved' : 'Import finished';
  return sendSuccess(res, { message, data: { report } });
});

/** GET /api/admin/products/import/template — download the CSV template */
const downloadTemplate = (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="saathmein-products-template.csv"');
  res.send(productImport.getImportTemplateCsv());
};

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  getImageUploadParams,
  addImage,
  removeImage,
  importProducts,
  downloadTemplate,
};
