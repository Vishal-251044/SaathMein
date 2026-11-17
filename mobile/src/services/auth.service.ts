/**
 * Auth service — calls /api/auth/* for phone OTP login (ACC-1, ACC-4) and Google sign-in
 * (F4), and adds a verified phone to a Google account.
 */
import type { AppUser, AuthTokens, LoginResult } from '@/types/auth';

import { api, unwrap } from './api';

/**
 * Ask the API whether an OTP may be sent (abuse limits: 3 per 10 minutes per number).
 * @param phone - E.164 phone, e.g. +919876543210
 * @param deviceId - App install id
 */
export async function requestOtp(phone: string, deviceId: string): Promise<void> {
  await api.post('/auth/otp/request', { phone, deviceId });
}

/**
 * Exchange a Firebase ID token for SaathMein tokens.
 * @param idToken - Firebase ID token after OTP confirmation
 * @param deviceId - App install id
 * @returns User, new-user flag and tokens
 */
export function verifyOtp(idToken: string, deviceId: string): Promise<LoginResult> {
  return unwrap(api.post('/auth/otp/verify', { idToken, deviceId }));
}

/**
 * Exchange a Firebase ID token from Google sign-in for SaathMein tokens (F4).
 * @param idToken - Firebase ID token after the Google account picker
 * @param deviceId - App install id
 * @returns User, new-user flag and tokens
 */
export function googleLogin(idToken: string, deviceId: string): Promise<LoginResult> {
  return unwrap(api.post('/auth/google', { idToken, deviceId }));
}

/**
 * Add a verified phone to the signed-in account (Firebase phone ID token).
 * @param idToken - Firebase ID token after the OTP
 * @returns The updated user
 */
export async function linkPhone(idToken: string): Promise<AppUser> {
  return (await unwrap<{ user: AppUser }>(api.post('/users/me/phone', { idToken }))).user;
}

/**
 * Rotate the refresh token (single use — store the new one right away).
 * @param refreshToken - Current refresh token
 * @returns New token pair
 */
export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  const data = await unwrap<{ tokens: AuthTokens }>(api.post('/auth/refresh', { refreshToken }));
  return data.tokens;
}

/**
 * End this device's session on the server.
 * @param refreshToken - Refresh token of the session
 */
export async function logout(refreshToken: string): Promise<void> {
  await api.post('/auth/logout', { refreshToken });
}

/**
 * Load the logged-in user.
 * @returns Current user and roles
 */
export function getMe(): Promise<{ user: AppUser; roles: string[] }> {
  return unwrap(api.get('/auth/me'));
}
