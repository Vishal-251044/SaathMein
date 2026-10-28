/**
 * Base API client. Every backend call goes through feature services built on this
 * client — components never call axios/fetch directly.
 * - Sends cookies (staff refresh cookie) and the X-Requested-With CSRF header.
 * - Adds the in-memory staff access token as a Bearer header.
 * - On 401 TOKEN_EXPIRED, refreshes once and retries the request.
 * Errors are normalised to `ApiClientError` with the backend's message and code.
 */
import axios from 'axios';
import { API_URL, API_TIMEOUT_MS } from '@/utils/constants';
import { getAccessToken, refreshAccessToken } from '@/lib/staffSession';

/** Error thrown by every service call, carrying the backend's message and error code. */
export class ApiClientError extends Error {
  /**
   * @param {string} message - User-friendly message
   * @param {Object} [options]
   * @param {number} [options.status] - HTTP status (undefined for network errors)
   * @param {string} [options.code] - Backend error code, e.g. "VALIDATION_ERROR"
   * @param {*} [options.details] - Field errors or extra info
   */
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const api = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT_MS,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
});

api.interceptors.request.use((request) => {
  const token = getAccessToken();
  if (token && !request.headers.Authorization) {
    request.headers.Authorization = `Bearer ${token}`;
  }
  return request;
});

/**
 * Turn an axios error into an ApiClientError.
 * @param {import('axios').AxiosError} error - Axios error
 * @returns {ApiClientError}
 */
const toClientError = (error) => {
  if (error.response) {
    const { status, data } = error.response;
    return new ApiClientError(data?.message || 'Something went wrong. Please try again.', {
      status,
      code: data?.error?.code,
      details: data?.error?.details,
    });
  }
  return new ApiClientError('Cannot reach SaathMein right now. Check your connection.', {
    code: 'NETWORK_ERROR',
  });
};

// Unwrap `{ success, message, data }`; refresh an expired access token once, then retry
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const original = error.config;
    const isExpired =
      error.response?.status === 401 && error.response.data?.error?.code === 'TOKEN_EXPIRED';

    if (isExpired && original && !original._retried) {
      original._retried = true;
      try {
        const token = await refreshAccessToken();
        if (token) {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }
      } catch {
        // fall through to the original error
      }
    }
    return Promise.reject(toClientError(error));
  },
);

export default api;
