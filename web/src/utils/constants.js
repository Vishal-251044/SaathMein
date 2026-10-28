/**
 * App-wide constants for the SaathMein web app (dealer dashboard + admin console).
 */

export const APP_NAME = 'SaathMein';
export const APP_TAGLINE = 'Buy together. Save together.';

/** Base URL of the backend API (from web/.env.local). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/** Request timeout for API calls, in milliseconds. */
export const API_TIMEOUT_MS = 15000;

/** Top-level route paths. Admin is intentionally not linked from public pages (ADL-1). */
export const ROUTES = Object.freeze({
  HOME: '/',
  SELLER: '/seller',
});
