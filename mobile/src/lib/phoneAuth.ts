/**
 * Firebase phone OTP (ACC-1), wrapped so the rest of the app never touches Firebase.
 *
 * React Native Firebase is a native module: it works in EAS development / production
 * builds with google-services.json, but NOT in Expo Go or on web. In those cases
 * isPhoneAuthAvailable() returns false and the login screen explains what to do.
 *
 * Firebase is only used to send and check the SMS code. Right after that, the Firebase
 * ID token is exchanged for SaathMein tokens and the Firebase session is signed out.
 */
import type { ConfirmationResult } from '@react-native-firebase/auth';
import { Platform } from 'react-native';

type AuthModule = typeof import('@react-native-firebase/auth');

let authModule: AuthModule | null | undefined;
let pendingConfirmation: ConfirmationResult | null = null;

/** Error codes the UI maps to translated messages. */
export type PhoneAuthErrorCode =
  | 'PHONE_AUTH_UNAVAILABLE'
  | 'INVALID_CODE'
  | 'CODE_EXPIRED'
  | 'TOO_MANY_ATTEMPTS'
  | 'NETWORK_ERROR'
  | 'PHONE_AUTH_FAILED';

/** Error thrown by this module, with a code the UI can translate. */
export class PhoneAuthError extends Error {
  code: PhoneAuthErrorCode;

  /** @param code - Stable error code @param message - Developer message (not shown to users) */
  constructor(code: PhoneAuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'PhoneAuthError';
    this.code = code;
  }
}

/**
 * Load the native Firebase Auth module once (lazily, so Expo Go does not crash on import).
 * @returns The module, or null when it is not compiled into this build
 */
function loadAuthModule(): AuthModule | null {
  if (authModule !== undefined) return authModule;
  if (Platform.OS === 'web') {
    authModule = null;
    return authModule;
  }
  try {
    // Lazy require on purpose: a top-level import crashes Expo Go, which lacks the native module
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded: AuthModule = require('@react-native-firebase/auth');
    loaded.getAuth(); // throws when the native app module (RNFBAppModule) is missing
    authModule = loaded;
  } catch {
    authModule = null;
  }
  return authModule;
}

/** @returns True when this build can send Firebase OTP SMS */
export function isPhoneAuthAvailable(): boolean {
  return loadAuthModule() !== null;
}

/**
 * Map Firebase error codes to our codes.
 * @param error - Error thrown by Firebase
 * @returns PhoneAuthError with a translatable code
 */
function toPhoneAuthError(error: unknown): PhoneAuthError {
  const code = (error as { code?: string })?.code ?? '';
  if (code.includes('invalid-verification-code')) return new PhoneAuthError('INVALID_CODE');
  if (code.includes('session-expired') || code.includes('code-expired')) {
    return new PhoneAuthError('CODE_EXPIRED');
  }
  if (code.includes('too-many-requests') || code.includes('quota-exceeded')) {
    return new PhoneAuthError('TOO_MANY_ATTEMPTS');
  }
  if (code.includes('network-request-failed')) return new PhoneAuthError('NETWORK_ERROR');
  return new PhoneAuthError('PHONE_AUTH_FAILED', code);
}

/**
 * Ask Firebase to send the OTP SMS. Call only after the API approved the request.
 * @param phoneE164 - Phone in E.164, e.g. +919876543210
 */
export async function sendOtp(phoneE164: string): Promise<void> {
  const firebase = loadAuthModule();
  if (!firebase) throw new PhoneAuthError('PHONE_AUTH_UNAVAILABLE');
  try {
    const auth = firebase.getAuth();
    // Clear any earlier Firebase user so confirmOtp can never return another number's token
    if (auth.currentUser) await firebase.signOut(auth);
    pendingConfirmation = await firebase.signInWithPhoneNumber(auth, phoneE164);
  } catch (error) {
    throw toPhoneAuthError(error);
  }
}

/**
 * Confirm the 6-digit code and get a Firebase ID token for the API.
 * Also handles Android instant verification (Firebase signs in without a typed code).
 * @param code - Code from the SMS
 * @returns Firebase ID token
 */
export async function confirmOtp(code: string): Promise<string> {
  const firebase = loadAuthModule();
  if (!firebase) throw new PhoneAuthError('PHONE_AUTH_UNAVAILABLE');

  try {
    const auth = firebase.getAuth();
    // Android may already have verified the number automatically
    const user = auth.currentUser ?? (await pendingConfirmation?.confirm(code))?.user;
    if (!user) throw new PhoneAuthError('CODE_EXPIRED');
    return await firebase.getIdToken(user, true);
  } catch (error) {
    throw error instanceof PhoneAuthError ? error : toPhoneAuthError(error);
  }
}

/**
 * Watch for Android instant verification while the OTP screen is open.
 * @param onVerified - Called once Firebase has signed in by itself
 * @returns Unsubscribe function
 */
export function onAutoVerified(onVerified: () => void): () => void {
  const firebase = loadAuthModule();
  if (!firebase) return () => {};
  return firebase.onAuthStateChanged(firebase.getAuth(), (user) => {
    if (user) onVerified();
  });
}

/** End the temporary Firebase session (SaathMein tokens take over). */
export async function signOutOfFirebase(): Promise<void> {
  pendingConfirmation = null;
  const firebase = loadAuthModule();
  if (!firebase) return;
  try {
    await firebase.signOut(firebase.getAuth());
  } catch {
    // Not signed in to Firebase — nothing to do
  }
}
