/**
 * Admin sellers service — /api/admin/sellers (KYC queue and review, TRU-1),
 * /api/admin/product-requests and /api/admin/audit-logs (ADL-5).
 */
import api from '@/services/api';

/**
 * @param {{ kycStatus?: string, q?: string, page?: number, limit?: number }} params
 * @returns {Promise<{ sellers: Object[], meta: Object }>}
 */
export const listSellers = async (params) => {
  const response = await api.get('/admin/sellers', { params });
  return { sellers: response.data.sellers, meta: response.meta };
};

/** @param {string} sellerId @returns {Promise<Object>} Seller with document preview links */
export const getSeller = async (sellerId) =>
  (await api.get(`/admin/sellers/${sellerId}`)).data.seller;

/** @param {string} sellerId @param {string} [note] @returns {Promise<Object>} Seller */
export const approveKyc = async (sellerId, note) =>
  (await api.post(`/admin/sellers/${sellerId}/kyc/approve`, note ? { note } : {})).data.seller;

/** @param {string} sellerId @param {string} reason - Shown to the dealer @returns {Promise<Object>} */
export const rejectKyc = async (sellerId, reason) =>
  (await api.post(`/admin/sellers/${sellerId}/kyc/reject`, { reason })).data.seller;

/** @param {string} sellerId @returns {Promise<Object>} Seller after retrying payout setup */
export const retryPayoutSetup = async (sellerId) =>
  (await api.post(`/admin/sellers/${sellerId}/razorpay/retry`)).data.seller;

/**
 * @param {{ status?: string, page?: number, limit?: number }} params
 * @returns {Promise<{ requests: Object[], meta: Object }>}
 */
export const listProductRequests = async (params) => {
  const response = await api.get('/admin/product-requests', { params });
  return { requests: response.data.requests, meta: response.meta };
};

/** @param {string} requestId @param {{ status: string, productId?: string }} changes */
export const updateProductRequest = async (requestId, changes) =>
  (await api.patch(`/admin/product-requests/${requestId}`, changes)).data.request;

/**
 * @param {{ targetType?: string, targetId?: string, page?: number, limit?: number }} params
 * @returns {Promise<{ entries: Object[], meta: Object }>}
 */
export const listAuditLogs = async (params) => {
  const response = await api.get('/admin/audit-logs', { params });
  return { entries: response.data.entries, meta: response.meta };
};
