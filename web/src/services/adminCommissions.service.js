/**
 * Admin Commissions — /api/admin/commissions, /api/admin/commission-invoices (PRD §10.11).
 * Owner, Admin, Finance. City and category filters use the public lists, because Finance
 * cannot open the admin catalog.
 */
import api from '@/services/api';
import { saveBlob } from '@/utils/genericFunctions';

/**
 * @param {{ cityId?: string, categoryId?: string, from?: string, to?: string, page?: number, limit?: number }} params
 * @returns {Promise<{ commissions: Object[], totals: Object, meta: Object }>}
 */
export const listCommissions = async (params) => {
  const response = await api.get('/admin/commissions', { params });
  return { ...response.data, meta: response.meta };
};

/** @param {Object} params - Same filters as listCommissions */
export const downloadCommissionsCsv = async (params) => {
  const blob = await api.get('/admin/commissions', {
    params: { ...params, format: 'csv', page: undefined, limit: undefined },
    responseType: 'blob',
  });
  saveBlob(blob, `saathmein-commissions-${new Date().toISOString().slice(0, 10)}.csv`);
};

/** @param {{ month?: string, page?: number }} params */
export const listInvoices = async (params) => {
  const response = await api.get('/admin/commission-invoices', { params });
  return { invoices: response.data.invoices, meta: response.meta };
};

/** @param {string} invoiceId */
export const getInvoice = async (invoiceId) =>
  (await api.get(`/admin/commission-invoices/${invoiceId}`)).data.invoice;

/** @param {string} month - "YYYY-MM" (finished month) @returns {Promise<{ issued: number }>} */
export const generateInvoices = async (month) =>
  (await api.post('/admin/commission-invoices/generate', { month })).data;

/** @returns {Promise<Object[]>} Active cities (public list) */
export const listPublicCities = async () => (await api.get('/cities')).data.cities;

/** @returns {Promise<Object[]>} Category tree (public list) */
export const listPublicCategories = async () => (await api.get('/categories')).data.categories;
