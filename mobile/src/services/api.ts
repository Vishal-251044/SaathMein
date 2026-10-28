/**
 * Base API client. Feature services (one file per feature) build on this client;
 * screens and components never call axios/fetch directly.
 * - Adds the in-memory access token as a Bearer header.
 * - On 401 TOKEN_EXPIRED, refreshes once (single-flight) and retries the request.
 * - Normalises every failure to ApiClientError with the backend's message and code.
 */
import { AxiosError, create, type InternalAxiosRequestConfig } from 'axios';

import { getAccessToken, refreshAccessToken } from '@/lib/authSession';
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
type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

export const api = create({
  baseURL: API_URL,
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((request) => {
  const token = getAccessToken();
  if (token && !request.headers.Authorization) {
    request.headers.Authorization = `Bearer ${token}`;
  }
  return request;
});

/**
 * Convert an axios error into an ApiClientError.
 * @param error - Axios error
 * @returns Normalised error
 */
function toClientError(error: AxiosError<ErrorBody>): ApiClientError {
  if (error.response) {
    const body = error.response.data;
    return new ApiClientError(body?.message ?? 'Request failed', {
      status: error.response.status,
      code: body?.error?.code,
      details: body?.error?.details,
    });
  }
  return new ApiClientError('Network error', { code: 'NETWORK_ERROR' });
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ErrorBody>) => {
    const original = error.config as RetriableConfig | undefined;
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

/**
 * Unwrap the `data` field of a standard response.
 * @param request - Axios request promise
 * @returns The response's data payload
 */
export async function unwrap<T>(request: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  const response = await request;
  return response.data.data;
}
