/**
 * Admin monitors service (PRD §10.11, MON-1..4): overview, groups, auctions with bid
 * timeline, payments, dealers, buyers, disputes, system health, the staff actions taken
 * from them (each with a reason note), alerts, Team (Owner) and the audit log (+ CSV).
 */
import api from '@/services/api';
import { saveBlob } from '@/utils/genericFunctions';

/** Drop empty filter values. */
const clean = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value != null));

/* ---- monitors ---- */

/** @param {{ cityId?: string, categoryId?: string }} params @returns {Promise<Object>} */
export const getOverview = async (params) =>
  (await api.get('/admin/monitor/overview', { params: clean(params) })).data;

/** @param {{ cityId?: string, categoryId?: string }} params @returns {Promise<Object>} */
export const getGroupsMonitor = async (params) =>
  (await api.get('/admin/monitor/groups', { params: clean(params) })).data;

/** @param {{ status?: 'live'|'recent', cityId?: string, categoryId?: string, page?: number }} params */
export const listAuctions = async (params) => {
  const response = await api.get('/admin/monitor/auctions', { params: clean(params) });
  return { auctions: response.data.auctions, meta: response.meta };
};

/** @param {string} groupId @returns {Promise<Object>} Auction with bids and dealers */
export const getAuction = async (groupId) =>
  (await api.get(`/admin/monitor/auctions/${groupId}`)).data.auction;

/** @param {{ from?: string, to?: string }} params @returns {Promise<Object>} */
export const getPaymentSummary = async (params) =>
  (await api.get('/admin/monitor/payments/summary', { params: clean(params) })).data;

/** @param {{ view?: string, q?: string, page?: number }} params */
export const listPayments = async (params) => {
  const response = await api.get('/admin/monitor/payments', { params: clean(params) });
  return { payments: response.data.payments, meta: response.meta };
};

/** @param {{ cityId?: string, categoryId?: string, page?: number }} params */
export const listDealers = async (params) => {
  const response = await api.get('/admin/monitor/dealers', { params: clean(params) });
  return { dealers: response.data.dealers, meta: response.meta };
};

/** @param {{ q?: string, page?: number }} params */
export const getBuyers = async (params) => {
  const response = await api.get('/admin/monitor/buyers', { params: clean(params) });
  return { ...response.data, meta: response.meta };
};

/** @returns {Promise<Object>} Disputes SLA numbers */
export const getDisputesMonitor = async () => (await api.get('/admin/monitor/disputes')).data;

/** @returns {Promise<Object>} System health */
export const getSystemHealth = async () => (await api.get('/admin/monitor/system')).data;

/* ---- actions (reason required) ---- */

/**
 * Run a staff action.
 * @param {{ path: string, body: Object }} input - e.g. { path: 'auctions/<id>/pause', body: { reason } }
 * @returns {Promise<Object>}
 */
export const runAction = async ({ path, body }) =>
  (await api.post(`/admin/monitor/${path}`, body)).data;

/* ---- alerts ---- */

/** @param {{ status?: string, type?: string, page?: number }} params */
export const listAlerts = async (params) => {
  const response = await api.get('/admin/alerts', { params: clean(params) });
  return { ...response.data, meta: response.meta };
};

/** @param {{ alertId: string, action: 'ack'|'close' }} input */
export const updateAlert = async ({ alertId, action }) =>
  (await api.patch(`/admin/alerts/${alertId}`, { action })).data.alert;

/* ---- team (Owner) ---- */

/** @returns {Promise<{ members: Object[], invites: Object[] }>} */
export const getTeam = async () => (await api.get('/admin/team')).data;

/** @param {{ email: string, role: string }} input */
export const inviteStaff = async (input) => (await api.post('/admin/team/invites', input)).data;

/** @param {string} inviteId */
export const revokeInvite = async (inviteId) =>
  (await api.delete(`/admin/team/invites/${inviteId}`)).data;

/** @param {{ userId: string, role: string, reason: string }} input */
export const changeRole = async ({ userId, ...body }) =>
  (await api.patch(`/admin/team/${userId}/role`, body)).data;

/** @param {{ userId: string, active: boolean, reason: string }} input */
export const setStaffStatus = async ({ userId, ...body }) =>
  (await api.patch(`/admin/team/${userId}/status`, body)).data;

/** @param {string} token @returns {Promise<{ email: string, role: string, roleLabel: string }>} */
export const previewInvite = async (token) =>
  (await api.get(`/admin/auth/invites/${token}`)).data.invite;

/** @param {{ token: string, name: string, password: string }} input */
export const acceptInvite = async ({ token, ...body }) =>
  (await api.post(`/admin/auth/invites/${token}/accept`, body)).data;

/* ---- audit log ---- */

/** @param {{ action?: string, targetType?: string, actorId?: string, from?: string, to?: string, page?: number }} params */
export const listAuditLogs = async (params) => {
  const response = await api.get('/admin/audit-logs', { params: clean(params) });
  return { entries: response.data.entries, meta: response.meta };
};

/** Download the filtered audit log as CSV. @param {Object} params */
export const downloadAuditCsv = async (params) => {
  const blob = await api.get('/admin/audit-logs', {
    params: { ...clean(params), format: 'csv', page: undefined, limit: undefined },
    responseType: 'blob',
  });
  saveBlob(blob, `saathmein-audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
};
