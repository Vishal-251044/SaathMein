/**
 * Disputes and reports — Support queue (/api/admin/disputes, /api/admin/reports) and the
 * dealer's side (/api/seller/disputes). TRU-3, TRU-4.
 */
import api, { sellerApi, uploadToCloudinary } from '@/services/api';

/* --------------------------------- Support ---------------------------------- */

/** @param {{ status?: string, page?: number }} params */
export const listAdminDisputes = async (params) => {
  const response = await api.get('/admin/disputes', { params });
  return { disputes: response.data.disputes, meta: response.meta };
};

/** @param {string} disputeId */
export const getAdminDispute = async (disputeId) =>
  (await api.get(`/admin/disputes/${disputeId}`)).data.dispute;

/**
 * @param {{ disputeId: string, outcome: string, creditPaise?: number, penalties?: string[],
 *   suspensionDays?: number, note: string }} input
 */
export const decideDispute = async ({ disputeId, ...decision }) =>
  (await api.post(`/admin/disputes/${disputeId}/decide`, decision)).data.dispute;

/** @param {{ status?: string, targetType?: string, page?: number }} params */
export const listAdminReports = async (params) => {
  const response = await api.get('/admin/reports', { params });
  return { reports: response.data.reports, meta: response.meta };
};

/** @param {{ reportId: string, action: string, note: string }} input */
export const decideReport = async ({ reportId, ...decision }) =>
  (await api.post(`/admin/reports/${reportId}/decide`, decision)).data;

/* ---------------------------------- Dealer ---------------------------------- */

/** @param {{ status?: string, page?: number }} params */
export const listSellerDisputes = async (params) => {
  const response = await sellerApi.get('/seller/disputes', { params });
  return { disputes: response.data.disputes, meta: response.meta };
};

/** @param {string} disputeId */
export const getSellerDispute = async (disputeId) =>
  (await sellerApi.get(`/seller/disputes/${disputeId}`)).data.dispute;

/**
 * Upload one private evidence file (photo or PDF).
 * @param {File} file
 * @returns {Promise<{ publicId: string, version: number, signature: string, format?: string }>}
 */
export const uploadSellerEvidence = async (file) => {
  const params = (await sellerApi.post('/seller/disputes/evidence-upload-params')).data;
  const uploaded = await uploadToCloudinary(
    params,
    file,
    'The file could not be uploaded. Use a PDF, JPG or PNG under 10 MB.',
  );
  return {
    publicId: uploaded.public_id,
    version: uploaded.version,
    signature: uploaded.signature,
    ...(['jpg', 'jpeg', 'png', 'pdf'].includes(uploaded.format) ? { format: uploaded.format } : {}),
  };
};

/** @param {{ disputeId: string, text: string, evidence?: Object[] }} input */
export const respondToDispute = async ({ disputeId, ...answer }) =>
  (await sellerApi.post(`/seller/disputes/${disputeId}/respond`, answer)).data.dispute;
