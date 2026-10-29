/**
 * Base API clients. Every backend call goes through feature services built on these
 * clients — components never call axios/fetch directly.
 * - `api` (default): admin console, uses the staff session.
 * - `sellerApi`: dealer dashboard, uses the dealer session.
 * Both send cookies (refresh cookie) and the X-Requested-With CSRF header, add the
 * in-memory access token as a Bearer header, and on 401 TOKEN_EXPIRED refresh once and
 * retry. Errors are normalised to `ApiClientError` with the backend's message and code.
 */
import axios from 'axios';
import { API_URL, API_TIMEOUT_MS } from '@/utils/constants';
import staffSession from '@/lib/staffSession';
import sellerSession from '@/lib/sellerSession';

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

/**
 * Create an API client bound to one session store.
 * @param {ReturnType<import('@/lib/sessionStore').createSessionStore>} session - Session store
 * @returns {import('axios').AxiosInstance}
 */
export const createApiClient = (session) => {
  const client = axios.create({
    baseURL: API_URL,
    timeout: API_TIMEOUT_MS,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
  });

  client.interceptors.request.use((request) => {
    const token = session.getAccessToken();
    if (token && !request.headers.Authorization) {
      request.headers.Authorization = `Bearer ${token}`;
    }
    return request;
  });

  // Unwrap `{ success, message, data }`; refresh an expired access token once, then retry
  client.interceptors.response.use(
    (response) => response.data,
    async (error) => {
      const original = error.config;
      const isExpired =
        error.response?.status === 401 && error.response.data?.error?.code === 'TOKEN_EXPIRED';

      if (isExpired && original && !original._retried) {
        original._retried = true;
        try {
          const token = await session.refreshAccessToken();
          if (token) {
            original.headers.Authorization = `Bearer ${token}`;
            return client(original);
          }
        } catch {
          // fall through to the original error
        }
      }
      return Promise.reject(toClientError(error));
    },
  );

  return client;
};

/**
 * Upload a file straight to Cloudinary with server-signed fields.
 * @param {{ uploadUrl: string, fields: Object }} params - From an upload-params endpoint
 * @param {File} file - File from an <input type="file">
 * @param {string} failMessage - Message when Cloudinary refuses the file
 * @returns {Promise<Object>} Cloudinary's response (public_id, version, signature, format)
 */
export const uploadToCloudinary = async ({ uploadUrl, fields }, file, failMessage) => {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));
  form.append('file', file);

  let response;
  try {
    response = await fetch(uploadUrl, { method: 'POST', body: form });
  } catch {
    throw new ApiClientError('The upload did not finish. Check your connection.', {
      code: 'NETWORK_ERROR',
    });
  }
  if (!response.ok) {
    throw new ApiClientError(failMessage, { status: response.status, code: 'UPLOAD_FAILED' });
  }
  return response.json();
};

const api = createApiClient(staffSession);
export const sellerApi = createApiClient(sellerSession);

export default api;
