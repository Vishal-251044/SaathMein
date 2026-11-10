/**
 * Dealer purchases, payouts and commission invoices — /api/seller/purchases,
 * /api/seller/payouts, /api/seller/commission-invoices (PRD §10.10, PUR-2, F17).
 */
import { sellerApi } from '@/services/api';

/** @param {string} code - Scanned QR payload or typed deal code @returns {Promise<Object>} */
export const lookupPurchase = async (code) =>
  (await sellerApi.post('/seller/purchases/lookup', { code })).data.purchase;

/** @param {string} code - Scanned QR payload or typed deal code @returns {Promise<Object>} */
export const confirmPurchase = async (code) =>
  (await sellerApi.post('/seller/purchases/confirm', { code })).data.purchase;

/**
 * @param {{ status?: string, page?: number }} params - status: open | completed | expired ...
 * @returns {Promise<{ purchases: Object[], meta: Object }>}
 */
export const listPurchases = async ({ status, page = 1 }) => {
  const response = await sellerApi.get('/seller/purchases', {
    params: { status: status || undefined, page, limit: 20 },
  });
  return { purchases: response.data.purchases, meta: response.meta };
};

/** @param {{ purchaseId: string, reason: string }} input @returns {Promise<Object>} */
export const objectToInvoice = async ({ purchaseId, reason }) =>
  (await sellerApi.post(`/seller/purchases/${purchaseId}/object`, { reason })).data.purchase;

/** @param {string} purchaseId @returns {Promise<string>} 10-minute private link */
export const getInvoiceUrl = async (purchaseId) =>
  (await sellerApi.get(`/seller/purchases/${purchaseId}/invoice-url`)).data.url;

/** @param {{ page?: number }} [params] @returns {Promise<Object>} totals, transfers, settlements, invoices, meta */
export const getPayouts = async ({ page = 1 } = {}) => {
  const response = await sellerApi.get('/seller/payouts', { params: { page, limit: 20 } });
  return { ...response.data, meta: response.meta };
};

/** @param {string} invoiceId @returns {Promise<Object>} */
export const getCommissionInvoice = async (invoiceId) =>
  (await sellerApi.get(`/seller/commission-invoices/${invoiceId}`)).data.invoice;
