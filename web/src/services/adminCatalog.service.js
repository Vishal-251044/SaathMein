/**
 * Admin catalog service — /api/admin/categories and /api/admin/products (CAT-1 to CAT-3).
 * Money is integer paise and percentages are basis points in every request and response.
 */
import api, { ApiClientError } from '@/services/api';

/* ----------------------------- Categories ----------------------------- */

/** @returns {Promise<Object[]>} Every category (flat) with rules */
export const listCategories = async () => (await api.get('/admin/categories')).data.categories;

/** @param {Object} category @returns {Promise<Object>} Created category */
export const createCategory = async (category) =>
  (await api.post('/admin/categories', category)).data.category;

/**
 * @param {string} categoryId - Category id
 * @param {Object} changes - Fields and/or partial rules
 * @returns {Promise<Object>} Updated category
 */
export const updateCategory = async (categoryId, changes) =>
  (await api.patch(`/admin/categories/${categoryId}`, changes)).data.category;

/* ------------------------------ Products ------------------------------ */

/**
 * @param {{ q?: string, categoryId?: string, status?: string, page?: number, limit?: number }} params
 * @returns {Promise<{ products: Object[], meta: Object }>}
 */
export const listProducts = async (params) => {
  const response = await api.get('/admin/products', { params });
  return { products: response.data.products, meta: response.meta };
};

/** @param {string} productId @returns {Promise<Object>} Product */
export const getProduct = async (productId) =>
  (await api.get(`/admin/products/${productId}`)).data.product;

/** @param {Object} product @returns {Promise<Object>} Created product */
export const createProduct = async (product) =>
  (await api.post('/admin/products', product)).data.product;

/**
 * @param {string} productId - Product id
 * @param {Object} changes - Fields to change
 * @returns {Promise<Object>} Updated product
 */
export const updateProduct = async (productId, changes) =>
  (await api.patch(`/admin/products/${productId}`, changes)).data.product;

/**
 * Upload an image straight to Cloudinary with server-signed params, then attach it.
 * @param {string} productId - Product id
 * @param {File} file - Image file from an <input type="file">
 * @returns {Promise<Object>} Updated product
 */
export const uploadProductImage = async (productId, file) => {
  const { uploadUrl, fields } = (
    await api.post(`/admin/products/${productId}/images/upload-params`)
  ).data;
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));
  form.append('file', file);

  const response = await fetch(uploadUrl, { method: 'POST', body: form });
  if (!response.ok) {
    throw new ApiClientError('The image could not be uploaded. Use JPG, PNG or WebP.', {
      status: response.status,
      code: 'UPLOAD_FAILED',
    });
  }
  const uploaded = await response.json();
  return (
    await api.post(`/admin/products/${productId}/images`, {
      publicId: uploaded.public_id,
      version: uploaded.version,
      signature: uploaded.signature,
    })
  ).data.product;
};

/**
 * @param {string} productId - Product id
 * @param {string} url - Image URL to remove
 * @returns {Promise<Object>} Updated product
 */
export const removeProductImage = async (productId, url) =>
  (await api.delete(`/admin/products/${productId}/images`, { params: { url } })).data.product;

/**
 * Import a products CSV (send the file as text/csv).
 * @param {File} file - CSV file
 * @param {{ dryRun: boolean }} options - dryRun = check only, save nothing
 * @returns {Promise<Object>} Import report
 */
export const importProducts = async (file, { dryRun }) => {
  const text = await file.text();
  const response = await api.post('/admin/products/import', text, {
    params: { dryRun: String(dryRun) },
    headers: { 'Content-Type': 'text/csv' },
    timeout: 120000,
  });
  return response.data.report;
};

/** @returns {Promise<string>} Template CSV text */
export const downloadImportTemplate = async () =>
  api.get('/admin/products/import/template', { responseType: 'text' });
