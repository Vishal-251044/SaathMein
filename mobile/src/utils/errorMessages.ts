/**
 * Map API and phone-auth error codes to translation keys, so every error a user sees
 * is translated (never a raw English backend message).
 */
import { PhoneAuthError } from '@/lib/phoneAuth';
import { ApiClientError } from '@/services/api';

const ERROR_KEYS: Record<string, string> = {
  // Backend (ApiClientError.code)
  OTP_LIMIT: 'errors.otpLimit',
  TOO_MANY_REQUESTS: 'errors.otpLimit',
  INVALID_PHONE: 'errors.invalidPhone',
  ACCOUNT_SUSPENDED: 'errors.accountSuspended',
  ACCOUNT_DELETED: 'errors.accountSuspended',
  FIREBASE_NOT_CONFIGURED: 'errors.loginUnavailable',
  DATABASE_UNAVAILABLE: 'errors.serviceUnavailable',
  INVALID_FIREBASE_TOKEN: 'errors.codeExpired',
  NETWORK_ERROR: 'errors.network',
  // Firebase phone auth (PhoneAuthError.code)
  INVALID_CODE: 'errors.invalidCode',
  CODE_EXPIRED: 'errors.codeExpired',
  TOO_MANY_ATTEMPTS: 'errors.tooManyAttempts',
  PHONE_AUTH_UNAVAILABLE: 'errors.phoneAuthUnavailable',
};

/**
 * Translation key for any error thrown during login.
 * @param error - Caught error
 * @returns i18n key such as "errors.invalidCode"
 */
export function getErrorMessageKey(error: unknown): string {
  if (error instanceof ApiClientError || error instanceof PhoneAuthError) {
    return ERROR_KEYS[error.code] ?? 'errors.generic';
  }
  return 'errors.generic';
}
