/**
 * Health service — checks that the app can reach the backend (GET /api/health).
 */
import { api, ApiClientError } from './api';

export type ServiceStatus = 'connected' | 'connecting' | 'disconnected' | 'not_configured';

export interface HealthReport {
  status: 'ok' | 'degraded';
  version: string;
  env: string;
  uptimeSeconds: number;
  timestamp: string;
  services: { database: ServiceStatus; redis: ServiceStatus };
}

/**
 * Fetch the backend health report.
 * A 503 "degraded" response still means the server is reachable, so it is returned
 * as a report instead of thrown.
 * @returns Health report
 * @throws ApiClientError when the server cannot be reached
 */
export async function getHealth(): Promise<HealthReport> {
  try {
    const response = await api.get<{ data: HealthReport }>('/health');
    return response.data.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 503 && error.details) {
      return error.details as HealthReport;
    }
    throw error;
  }
}
