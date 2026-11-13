'use client';

/**
 * AdminAuthContext — staff session state for the Owner / Admin Console.
 * - Restores the session on load from the httpOnly refresh cookie.
 * - Refreshes the 15-minute access token before it expires.
 * - Signs out after 30 minutes without activity (the API enforces this too).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import useIdleTimer from '@/hooks/useIdleTimer';
import { logout as logoutRequest, refreshSession } from '@/services/adminAuth.service';
import { refreshAccessToken, setAccessToken, setRefreshHandler } from '@/lib/staffSession';
import { closeStaffSocket } from '@/lib/staffSocket';
import { ADMIN_IDLE_TIMEOUT_MS, ADMIN_TOKEN_REFRESH_MS } from '@/utils/constants';

const AdminAuthContext = createContext(null);

export const SIGN_OUT_NOTICES = Object.freeze({
  IDLE: 'You were signed out after 30 minutes of inactivity.',
  ENDED: 'Your session ended. Please sign in again.',
});

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children - Admin pages
 * @returns {JSX.Element}
 */
export function AdminAuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', staff: null, notice: null });
  const isSignedIn = state.status === 'signedIn';

  /** Store a fresh session from login or refresh. */
  const applySession = useCallback((data) => {
    setAccessToken(data.accessToken);
    setState({ status: 'signedIn', staff: data.staff, notice: null });
  }, []);

  /** Forget the session locally (optionally with a message for the login page). */
  const clearSession = useCallback((notice = null) => {
    closeStaffSocket();
    setAccessToken(null);
    setState({ status: 'signedOut', staff: null, notice });
  }, []);

  // Let the API client refresh tokens through this provider
  useEffect(() => {
    setRefreshHandler(async () => {
      try {
        const data = await refreshSession();
        applySession(data);
        return data.accessToken;
      } catch (error) {
        clearSession(error.code === 'SESSION_IDLE' ? SIGN_OUT_NOTICES.IDLE : null);
        throw error;
      }
    });
    return () => setRefreshHandler(null);
  }, [applySession, clearSession]);

  // On first load, try to restore a session from the refresh cookie
  useEffect(() => {
    refreshAccessToken().catch(() => {});
  }, []);

  // Refresh the access token shortly before it expires while signed in
  useEffect(() => {
    if (!isSignedIn) return undefined;
    const interval = setInterval(() => {
      refreshAccessToken().catch(() => {});
    }, ADMIN_TOKEN_REFRESH_MS);
    return () => clearInterval(interval);
  }, [isSignedIn]);

  /** Sign out on the server and locally. */
  const logout = useCallback(
    async (notice = null) => {
      try {
        await logoutRequest();
      } catch {
        // Even if the network call fails, the local session must end
      }
      clearSession(notice);
    },
    [clearSession],
  );

  const handleIdle = useCallback(() => logout(SIGN_OUT_NOTICES.IDLE), [logout]);
  useIdleTimer({ timeoutMs: ADMIN_IDLE_TIMEOUT_MS, onIdle: handleIdle, enabled: isSignedIn });

  const value = useMemo(
    () => ({ ...state, isSignedIn, completeLogin: applySession, logout }),
    [state, isSignedIn, applySession, logout],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

/**
 * Access the staff session.
 * @returns {{ status: 'loading'|'signedIn'|'signedOut', staff: Object|null, notice: string|null,
 *   isSignedIn: boolean, completeLogin: Function, logout: Function }}
 */
export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used inside <AdminAuthProvider>');
  return context;
}
