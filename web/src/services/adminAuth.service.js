/**
 * Admin auth service — calls /api/admin/auth/* (ADL-1 to ADL-4).
 * Each function returns the `data` part of the standard API response.
 */
import api from '@/services/api';

/**
 * Step 1: email + password.
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ step: 'verify_2fa'|'setup_2fa', challengeToken: string,
 *   setup?: { secret: string, otpAuthUrl: string } }>}
 */
export const loginWithPassword = async (credentials) =>
  (await api.post('/admin/auth/login', credentials)).data;

/**
 * Step 2: authenticator or backup code. Sets the httpOnly refresh cookie.
 * @param {{ challengeToken: string, code: string }} payload
 * @returns {Promise<{ staff: Object, accessToken: string, accessTokenExpiresAt: string,
 *   sessionExpiresAt: string, backupCodes?: string[] }>}
 */
export const verifyTwoFactor = async (payload) =>
  (await api.post('/admin/auth/2fa/verify', payload)).data;

/**
 * Exchange the refresh cookie for a new access token.
 * @returns {Promise<{ staff: Object, accessToken: string, accessTokenExpiresAt: string }>}
 */
export const refreshSession = async () => (await api.post('/admin/auth/refresh')).data;

/**
 * End the staff session and clear the cookie.
 * @returns {Promise<void>}
 */
export const logout = async () => {
  await api.post('/admin/auth/logout');
};
