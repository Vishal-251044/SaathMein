/**
 * App-wide constants for the SaathMein web app (dealer dashboard + admin console).
 */

export const APP_NAME = 'SaathMein';
export const APP_TAGLINE = 'Buy together. Save together.';

/** Base URL of the backend API (from web/.env.local). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/** Request timeout for API calls, in milliseconds. */
export const API_TIMEOUT_MS = 15000;

/** Admin console signs out after this long without activity (ADL-4; the API enforces it too). */
export const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** Refresh the 15-minute staff access token a little before it expires. */
export const ADMIN_TOKEN_REFRESH_MS = 13 * 60 * 1000;

/** Top-level route paths. Admin is intentionally not linked from public pages (ADL-1). */
export const ROUTES = Object.freeze({
  HOME: '/',
  SELLER: '/seller',
  ADMIN: '/admin',
  ADMIN_LOGIN: '/admin/login',
});

/** Staff role labels shown in the console (PRD §8.2). */
export const STAFF_ROLE_LABELS = Object.freeze({
  owner: 'Owner',
  admin: 'Admin',
  deal_manager: 'Deal Manager',
  finance: 'Finance',
  support: 'Support',
});
