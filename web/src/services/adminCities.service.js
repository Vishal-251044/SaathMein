/**
 * Admin cities service — /api/admin/cities (CAT-4). Each function returns response `data`.
 */
import api from '@/services/api';

/** @returns {Promise<Object[]>} All cities with all areas */
export const listCities = async () => (await api.get('/admin/cities')).data.cities;

/**
 * @param {{ name: string, state: string, nameTranslations?: Object, location?: number[] }} city
 * @returns {Promise<Object>} Created city
 */
export const createCity = async (city) => (await api.post('/admin/cities', city)).data.city;

/**
 * @param {string} cityId - City id
 * @param {Object} changes - name, state, nameTranslations, location, active
 * @returns {Promise<Object>} Updated city
 */
export const updateCity = async (cityId, changes) =>
  (await api.patch(`/admin/cities/${cityId}`, changes)).data.city;

/**
 * @param {string} cityId - City id
 * @param {{ name: string, pincodes: string[], nameTranslations?: Object }} area
 * @returns {Promise<Object>} Updated city
 */
export const addArea = async (cityId, area) =>
  (await api.post(`/admin/cities/${cityId}/areas`, area)).data.city;

/**
 * @param {string} cityId - City id
 * @param {string} areaId - Area id
 * @param {Object} changes - name, pincodes, nameTranslations, active
 * @returns {Promise<Object>} Updated city
 */
export const updateArea = async (cityId, areaId, changes) =>
  (await api.patch(`/admin/cities/${cityId}/areas/${areaId}`, changes)).data.city;
