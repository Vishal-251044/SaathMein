'use client';

/**
 * SellerAuthContext — dealer session for /seller/* (separate from the admin session).
 * - Restores the session on load from the httpOnly refresh cookie.
 * - Refreshes the 15-minute access token before it expires.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { logout as logoutRequest, refreshSession } from '@/services/sellerAuth.service';
import sellerSession from '@/lib/sellerSession';
import { closeSellerSocket } from '@/lib/sellerSocket';
import { SELLER_TOKEN_REFRESH_MS } from '@/utils/constants';

const SellerAuthContext = createContext(null);

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children - Dealer pages
 * @returns {JSX.Element}
 */
export function SellerAuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState({ status: 'loading', user: null });
  const isSignedIn = state.status === 'signedIn';

  /** Store a fresh session from register, login, invite or refresh. */
  const applySession = useCallback((data) => {
    sellerSession.setAccessToken(data.accessToken);
    setState({ status: 'signedIn', user: data.user });
  }, []);

  /** Forget the session locally and drop cached dealer data. */
  const clearSession = useCallback(() => {
    sellerSession.setAccessToken(null);
    closeSellerSocket();
    queryClient.removeQueries({ queryKey: ['seller'] });
    setState({ status: 'signedOut', user: null });
  }, [queryClient]);

  useEffect(() => {
    sellerSession.setRefreshHandler(async () => {
      try {
        const data = await refreshSession();
        applySession(data);
        return data.accessToken;
      } catch (error) {
        clearSession();
        throw error;
      }
    });
    return () => sellerSession.setRefreshHandler(null);
  }, [applySession, clearSession]);

  // On first load, try to restore a session from the refresh cookie
  useEffect(() => {
    sellerSession.refreshAccessToken().catch(() => {});
  }, []);

  useEffect(() => {
    if (!isSignedIn) return undefined;
    const interval = setInterval(() => {
      sellerSession.refreshAccessToken().catch(() => {});
    }, SELLER_TOKEN_REFRESH_MS);
    return () => clearInterval(interval);
  }, [isSignedIn]);

  /** Sign out on the server and locally. */
  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Even if the network call fails, the local session must end
    }
    clearSession();
  }, [clearSession]);

  /** Update the signed-in user (e.g. after email verification). */
  const updateUser = useCallback((user) => setState((prev) => ({ ...prev, user })), []);

  const value = useMemo(
    () => ({ ...state, isSignedIn, completeLogin: applySession, logout, updateUser }),
    [state, isSignedIn, applySession, logout, updateUser],
  );

  return <SellerAuthContext.Provider value={value}>{children}</SellerAuthContext.Provider>;
}

/**
 * Access the dealer session.
 * @returns {{ status: 'loading'|'signedIn'|'signedOut', user: Object|null, isSignedIn: boolean,
 *   completeLogin: Function, logout: Function, updateUser: Function }}
 */
export function useSellerAuth() {
  const context = useContext(SellerAuthContext);
  if (!context) throw new Error('useSellerAuth must be used inside <SellerAuthProvider>');
  return context;
}
