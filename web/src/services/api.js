/**
 * Base API client. Every backend call goes through feature services built on this
 * client — components never call axios/fetch directly.
 * Errors are normalised to `ApiClientError` with the backend's message and code.
 */
import axios from 'axios';
import { API_URL, API_TIMEOUT_MS } from '@/utils/constants';

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
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Unwrap the standard `{ success, message, data }` response and normalise errors.
 * Auth headers and token refresh are added on Day 2.
 */
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      return Promise.reject(
        new ApiClientError(data?.message || 'Something went wrong. Please try again.', {
          status,
          code: data?.error?.code,
          details: data?.error?.details,
        }),
      );
    }
    return Promise.reject(
      new ApiClientError('Cannot reach SaathMein right now. Check your connection.', {
        code: 'NETWORK_ERROR',
      }),
    );
  },
);

export default api;
