/**
 * Base API client. Feature services (one file per feature) build on this client;
 * screens and components never call axios/fetch directly.
 * Unwraps the backend's `{ success, message, data }` format and normalises errors.
 * Auth headers and token refresh are added on Day 2.
 */
import { AxiosError, create } from 'axios';

import { API_TIMEOUT_MS, API_URL } from '@/utils/constants';

/** Standard backend response envelope. */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

/** Error thrown by every service call. `code` is the backend error code or NETWORK_ERROR. */
export class ApiClientError extends Error {
  status?: number;
  code: string;
  details?: unknown;

  /**
   * @param message - Message from the backend (or a generic one)
   * @param options - HTTP status, error code and extra details
   */
  constructor(message: string, options: { status?: number; code?: string; details?: unknown }) {
    super(message);
    this.name = 'ApiClientError';
    this.status = options.status;
    this.code = options.code ?? 'UNKNOWN_ERROR';
    this.details = options.details;
  }
}

type ErrorBody = { message?: string; error?: { code?: string; details?: unknown } };

export const api = create({
  baseURL: API_URL,
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ErrorBody>) => {
    if (error.response) {
      const body = error.response.data;
      return Promise.reject(
        new ApiClientError(body?.message ?? 'Request failed', {
          status: error.response.status,
          code: body?.error?.code,
          details: body?.error?.details,
        }),
      );
    }
    return Promise.reject(new ApiClientError('Network error', { code: 'NETWORK_ERROR' }));
  },
);
