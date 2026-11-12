/**
 * Admin → Curation and Admin → Settings — /api/admin/curation, /api/admin/settings
 * (F34, F35). Owner and Admin.
 */
import api, { uploadToCloudinary } from '@/services/api';

/** @param {{ type?: string }} [params] @returns {Promise<Object[]>} */
export const listCuration = async (params) =>
  (await api.get('/admin/curation', { params })).data.items;

/** @param {Object} item @returns {Promise<Object>} */
export const createCuration = async (item) => (await api.post('/admin/curation', item)).data.item;

/** @param {{ itemId: string, changes: Object }} input @returns {Promise<Object>} */
export const updateCuration = async ({ itemId, changes }) =>
  (await api.patch(`/admin/curation/${itemId}`, changes)).data.item;

/** @param {string} itemId */
export const deleteCuration = async (itemId) => api.delete(`/admin/curation/${itemId}`);

/**
 * Upload a banner image and return the signed upload to attach to the item.
 * @param {File} file - JPG / PNG / WEBP
 * @returns {Promise<{ publicId: string, version: number, signature: string }>}
 */
export const uploadBannerImage = async (file) => {
  const params = (await api.post('/admin/curation/banner-upload-params')).data;
  const uploaded = await uploadToCloudinary(
    params,
    file,
    'The image could not be uploaded. Use a JPG, PNG or WEBP under 10 MB.',
  );
  return { publicId: uploaded.public_id, version: uploaded.version, signature: uploaded.signature };
};

/** @param {{ id: string, order: number }[]} order */
export const saveCategoryOrder = async (order) =>
  (await api.patch('/admin/curation/category-order', { order })).data;

/** @returns {Promise<Record<string, { values: Object, defaults: Object }>>} */
export const getSettings = async () => (await api.get('/admin/settings')).data.settings;

/** @param {{ key: string, changes: Object }} input @returns {Promise<Object>} Saved values */
export const updateSettings = async ({ key, changes }) =>
  (await api.patch(`/admin/settings/${key}`, changes)).data.values;
