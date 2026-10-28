/**
 * Auth store (Zustand) — who is logged in, and the session lifecycle:
 * - bootstrap(): on app start, use the stored refresh token to restore the session,
 *   so users stay logged in after restarting the app (Day 2 "Done when").
 * - completeLogin(): save tokens after OTP login.
 * - logout(): end the session on the server and on the phone.
 * Offline at startup: the user stays logged in and the session refreshes on the next request.
 */
import { create } from 'zustand';

import { setAccessToken, setRefreshHandler } from '@/lib/authSession';
import { signOutOfFirebase } from '@/lib/phoneAuth';
import { getItem, removeItem, setItem, STORAGE_KEYS } from '@/lib/secureStorage';
import { ApiClientError } from '@/services/api';
import * as authService from '@/services/auth.service';
import type { AppUser, AuthTokens, LoginResult } from '@/types/auth';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

/** Longest time the splash screen waits for the session check at startup. */
const BOOTSTRAP_MAX_WAIT_MS = 5000;

interface AuthState {
  status: AuthStatus;
  /** Null while signed out, or when signed in but the profile could not load yet (offline). */
  user: AppUser | null;
  bootstrap: () => Promise<void>;
  completeLogin: (result: LoginResult) => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Replace the cached user after a profile change from the API. */
  setUser: (user: AppUser) => void;
  logout: () => Promise<void>;
  /** End the local session after the account was deleted on the server. */
  clearAfterAccountDeletion: () => Promise<void>;
}

/**
 * True when the server says the session is over (as opposed to a network problem).
 * @param error - Error from a refresh call
 */
function isSessionRejected(error: unknown): boolean {
  return error instanceof ApiClientError && (error.status === 401 || error.status === 403);
}

/**
 * Persist a new token pair: refresh token to secure storage, access token to memory.
 * @param tokens - Token pair from the API
 */
async function storeTokens(tokens: AuthTokens): Promise<void> {
  await setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
  setAccessToken(tokens.accessToken);
}

/** Remove every local trace of the session. */
async function clearLocalSession(): Promise<void> {
  setAccessToken(null);
  await removeItem(STORAGE_KEYS.REFRESH_TOKEN);
}

export const useAuthStore = create<AuthState>((set, get) => {
  /**
   * Exchange the stored refresh token for a new access token. Registered with the API
   * client so expired access tokens refresh automatically.
   * @returns New access token, or null when there is no session
   */
  const refreshSession = async (): Promise<string | null> => {
    const refreshToken = await getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) return null;
    try {
      const tokens = await authService.refreshTokens(refreshToken);
      await storeTokens(tokens);
      return tokens.accessToken;
    } catch (error) {
      if (isSessionRejected(error)) {
        await clearLocalSession();
        set({ status: 'signedOut', user: null });
      }
      throw error;
    }
  };

  setRefreshHandler(refreshSession);

  return {
    status: 'loading',
    user: null,

    bootstrap: async () => {
      const refreshToken = await getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) {
        set({ status: 'signedOut', user: null });
        return;
      }
      // Slow network: do not hold the splash screen longer than this; keep restoring in the background
      const optimisticTimer = setTimeout(() => {
        if (get().status === 'loading') set({ status: 'signedIn' });
      }, BOOTSTRAP_MAX_WAIT_MS);
      try {
        await refreshSession();
        const { user } = await authService.getMe();
        set({ status: 'signedIn', user });
      } catch (error) {
        // Session rejected → signed out (already handled). Network down → stay signed in.
        if (isSessionRejected(error)) set({ status: 'signedOut', user: null });
        else set({ status: 'signedIn' });
      } finally {
        clearTimeout(optimisticTimer);
      }
    },

    completeLogin: async ({ user, tokens }) => {
      await storeTokens(tokens);
      await signOutOfFirebase(); // Firebase was only needed to verify the SMS code
      set({ status: 'signedIn', user });
    },

    refreshUser: async () => {
      if (get().status !== 'signedIn') return;
      const { user } = await authService.getMe();
      set({ user });
    },

    setUser: (user) => set({ user }),

    clearAfterAccountDeletion: async () => {
      await clearLocalSession();
      await signOutOfFirebase();
      set({ status: 'signedOut', user: null });
    },

    logout: async () => {
      const refreshToken = await getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (refreshToken) {
        // Best effort: the phone signs out even if the server cannot be reached
        await authService.logout(refreshToken).catch(() => {});
      }
      await clearLocalSession();
      await signOutOfFirebase();
      set({ status: 'signedOut', user: null });
    },
  };
});
