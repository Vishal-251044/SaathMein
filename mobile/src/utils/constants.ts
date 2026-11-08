/**
 * App-wide constants. Environment values come from mobile/.env (EXPO_PUBLIC_* only —
 * these are bundled into the app and visible to anyone, so never put secrets there).
 */

/** Backend API base URL. On a real phone use your computer's LAN IP, not localhost. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000/api';

/** Socket.io server (live groups, chat, notifications). Defaults to the API host. */
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? API_URL.replace(/\/api\/?$/, '');

/** Polling interval for live screens while the socket is down (LIV-1 fallback). */
export const LIVE_FALLBACK_POLL_MS = 15_000;

/** Request timeout for API calls, in milliseconds. */
export const API_TIMEOUT_MS = 15000;

/** Default launch city (PRD Q1). */
export const DEFAULT_CITY = 'Pune';
