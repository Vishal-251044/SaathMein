/**
 * Admin → Curation and Admin → Settings (F34, F35). Owner and Admin. Every write is
 * audited with before / after through the audit middleware.
 */
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/ApiResponse');
const { setAudit } = require('../../services/audit.service');
const curation = require('../../services/admin/curation.service');
const adminSettings = require('../../services/admin/adminSettings.service');
const uploadService = require('../../services/upload.service');

/** GET /api/admin/curation?type= */
const listCuration = asyncHandler(async (req, res) => {
  const items = await curation.listItems(req.validatedQuery);
  return sendSuccess(res, { message: 'Curation fetched', data: { items } });
});

/** Turn a verified banner upload into the stored image. */
const withImage = (body) => {
  if (!body.image) return body;
  return { ...body, image: uploadService.verifyBannerUpload(body.image) };
};

/** POST /api/admin/curation */
const createCuration = asyncHandler(async (req, res) => {
  const item = await curation.createItem(withImage(req.body), req.staff.userId);
  setAudit(req, {
    action: 'curation.create',
    targetType: 'curation',
    targetId: item.id,
    after: item,
  });
  return sendSuccess(res, { statusCode: 201, message: 'Item added', data: { item } });
});

/** PATCH /api/admin/curation/:itemId */
const updateCuration = asyncHandler(async (req, res) => {
  const { before, after } = await curation.updateItem(
    req.params.itemId,
    withImage(req.body),
    req.staff.userId,
  );
  setAudit(req, {
    action: 'curation.update',
    targetType: 'curation',
    targetId: after.id,
    before,
    after,
  });
  return sendSuccess(res, { message: 'Item updated', data: { item: after } });
});

/** DELETE /api/admin/curation/:itemId */
const deleteCuration = asyncHandler(async (req, res) => {
  const item = await curation.deleteItem(req.params.itemId);
  setAudit(req, {
    action: 'curation.delete',
    targetType: 'curation',
    targetId: item.id,
    before: item,
  });
  return sendSuccess(res, { message: 'Item removed' });
});

/** POST /api/admin/curation/banner-upload-params */
const bannerUploadParams = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Upload ready', data: uploadService.createBannerUploadParams() }),
);

/** PATCH /api/admin/curation/category-order { order: [{ id, order }] } */
const categoryOrder = asyncHandler(async (req, res) => {
  const updated = await curation.reorderCategories(req.body.order);
  setAudit(req, {
    action: 'category.reorder',
    targetType: 'category',
    after: { order: req.body.order },
  });
  return sendSuccess(res, { message: 'Category order saved', data: { updated } });
});

/** GET /api/admin/settings */
const getSettings = asyncHandler(async (req, res) => {
  const settings = await adminSettings.getAllSettings();
  return sendSuccess(res, { message: 'Settings fetched', data: { settings } });
});

/** PATCH /api/admin/settings/:key */
const updateSettings = asyncHandler(async (req, res) => {
  const { before, after } = await adminSettings.updateSection(
    req.params.key,
    req.body,
    req.staff.userId,
  );
  setAudit(req, {
    action: 'settings.update',
    targetType: 'settings',
    targetId: req.params.key,
    before,
    after,
  });
  return sendSuccess(res, { message: 'Settings saved', data: { values: after } });
});

module.exports = {
  listCuration,
  createCuration,
  updateCuration,
  deleteCuration,
  bannerUploadParams,
  categoryOrder,
  getSettings,
  updateSettings,
};
