/**
 * Admin groups service — /api/admin/groups (read-only list + CSV export, MON-1).
 */
import api from '@/services/api';
import { saveBlob } from '@/utils/genericFunctions';

/**
 * @param {{ cityId?: string, categoryId?: string, status?: string, visibility?: string,
 *   from?: string, to?: string, q?: string, page?: number, limit?: number }} params
 * @returns {Promise<{ groups: Object[], meta: Object }>}
 */
export const listGroups = async (params) => {
  const response = await api.get('/admin/groups', { params });
  return { groups: response.data.groups, meta: response.meta };
};

/**
 * Download the filtered groups as a CSV file.
 * @param {Object} params - Same filters as listGroups
 * @returns {Promise<void>}
 */
export const downloadGroupsCsv = async (params) => {
  const blob = await api.get('/admin/groups', {
    params: { ...params, format: 'csv', page: undefined, limit: undefined },
    responseType: 'blob',
  });
  saveBlob(blob, `saathmein-groups-${new Date().toISOString().slice(0, 10)}.csv`);
};
