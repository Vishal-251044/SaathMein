/**
 * Google sign-in for buyers (PRD F4), wrapped so the rest of the app never touches the
 * native libraries. Flow: Google account picker → Google ID token → Firebase credential →
 * Firebase ID token for the API (which issues SaathMein tokens and then the Firebase
 * session is signed out, like phone login).
 *
 * Native modules: works in EAS development / production builds that include
 * @react-native-google-signin/google-signin and google-services.json, not in Expo Go or on
 * web. isGoogleSignInAvailable() is false there and the button is hidden.
 */
import { Platform } from 'react-native';

import { loadAuthModule } from '@/lib/phoneAuth';

type GoogleModule = typeof import('@react-native-google-signin/google-signin');

/** OAuth "Web client" id from Firebase → Authentication → Google (public, not a secret). */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

let googleModule: GoogleModule | null | undefined;
let configured = false;

/** Error codes the UI maps to translated messages. */
export type GoogleAuthErrorCode = 'GOOGLE_UNAVAILABLE' | 'GOOGLE_PLAY_SERVICES' | 'GOOGLE_FAILED';

/** Error thrown by this module, with a code the UI can translate. */
export class GoogleAuthError extends Error {
  code: GoogleAuthErrorCode;

  /** @param code - Stable error code @param message - Developer message (not shown to users) */
  constructor(code: GoogleAuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'GoogleAuthError';
    this.code = code;
  }
}

/** Load the native Google sign-in module once (null when this build does not have it). */
function loadGoogleModule(): GoogleModule | null {
  if (googleModule !== undefined) return googleModule;
  if (Platform.OS === 'web' || !WEB_CLIENT_ID || WEB_CLIENT_ID.startsWith('your_')) {
    googleModule = null;
    return googleModule;
  }
  try {
    // Lazy require: a top-level import crashes Expo Go, which lacks the native module
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    googleModule = require('@react-native-google-signin/google-signin') as GoogleModule;
  } catch {
    googleModule = null;
  }
  return googleModule;
}

/** @returns True when this build can sign in with Google (native modules + client id) */
export function isGoogleSignInAvailable(): boolean {
  return loadGoogleModule() !== null && loadAuthModule() !== null;
}

/**
 * Show the Google account picker and get a Firebase ID token for the API.
 * @returns Firebase ID token, or null when the person closed the picker
 * @throws {GoogleAuthError}
 */
export async function signInWithGoogle(): Promise<string | null> {
  const google = loadGoogleModule();
  const firebase = loadAuthModule();
  if (!google || !firebase) throw new GoogleAuthError('GOOGLE_UNAVAILABLE');
  const { GoogleSignin, statusCodes, isErrorWithCode } = google;

  if (!configured) {
    GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
    configured = true;
  }
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  } catch {
    throw new GoogleAuthError('GOOGLE_PLAY_SERVICES');
  }

  try {
    // Always show the picker (do not silently reuse the last account)
    await GoogleSignin.signOut().catch(() => {});
    const result = await GoogleSignin.signIn();
    if (result.type !== 'success') return null; // closed the picker
    const { idToken } = result.data;
    if (!idToken) throw new GoogleAuthError('GOOGLE_FAILED', 'No Google ID token');

    const auth = firebase.getAuth();
    if (auth.currentUser) await firebase.signOut(auth);
    const credential = firebase.GoogleAuthProvider.credential(idToken);
    const { user } = await firebase.signInWithCredential(auth, credential);
    return await firebase.getIdToken(user, true);
  } catch (error) {
    if (error instanceof GoogleAuthError) throw error;
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) return null;
    if (isErrorWithCode(error) && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new GoogleAuthError('GOOGLE_PLAY_SERVICES');
    }
    throw new GoogleAuthError('GOOGLE_FAILED', (error as { code?: string })?.code);
  }
}

/** Forget the Google account on this phone (logout), so the picker shows next time. */
export async function signOutOfGoogle(): Promise<void> {
  const google = loadGoogleModule();
  if (!google || !configured) return;
  await google.GoogleSignin.signOut().catch(() => {});
}
