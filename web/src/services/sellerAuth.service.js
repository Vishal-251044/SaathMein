/**
 * Dealer auth service — /api/seller/auth/* (F30). The refresh token is an httpOnly cookie;
 * the access token comes back in the body and is kept in memory.
 * Each function returns the `data` part of the standard API response.
 */
import { sellerApi } from '@/services/api';

/**
 * Create a dealer account (business + owner login).
 * @param {{ name: string, email: string, password: string, businessName: string, phone: string }} input
 * @returns {Promise<{ user: Object, accessToken: string }>}
 */
export const register = async (input) =>
  (await sellerApi.post('/seller/auth/register', input)).data;

/**
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ user: Object, accessToken: string }>}
 */
export const login = async (credentials) =>
  (await sellerApi.post('/seller/auth/login', credentials)).data;

/** @returns {Promise<{ user: Object, accessToken: string }>} New access token from the cookie */
export const refreshSession = async () => (await sellerApi.post('/seller/auth/refresh')).data;

/** @returns {Promise<void>} End the session and clear the cookie */
export const logout = async () => {
  await sellerApi.post('/seller/auth/logout');
};

/** @returns {Promise<{ sent: boolean, devLogged: boolean }>} Send a new email code */
export const sendEmailCode = async () =>
  (await sellerApi.post('/seller/auth/email/send-code')).data;

/** @param {string} code - 6-digit code @returns {Promise<Object>} Updated user */
export const verifyEmail = async (code) =>
  (await sellerApi.post('/seller/auth/email/verify', { code })).data.user;

/**
 * @param {string} token - Token from the invite link
 * @returns {Promise<{ businessName: string, email: string, name: string|null, hasAccount: boolean }>}
 */
export const getInvite = async (token) =>
  (await sellerApi.get(`/seller/auth/invites/${encodeURIComponent(token)}`)).data.invite;

/**
 * @param {{ token: string, name?: string, password: string }} input
 * @returns {Promise<{ user: Object, accessToken: string }>}
 */
export const acceptInvite = async (input) =>
  (await sellerApi.post('/seller/auth/invites/accept', input)).data;
