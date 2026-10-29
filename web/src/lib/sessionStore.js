/**
 * In-memory session store factory. The admin console and the dealer dashboard each get
 * their own store, so the two sessions never mix.
 * The access token is kept ONLY in memory (never localStorage), so a script injected into
 * the page cannot steal a long-lived token. Refresh tokens are httpOnly cookies set by the
 * API and are never visible to JavaScript.
 */

/**
 * @returns {{ getAccessToken: () => string|null, setAccessToken: (token: string|null) => void,
 *   setRefreshHandler: (handler: (() => Promise<string>)|null) => void,
 *   refreshAccessToken: () => Promise<string|null> }}
 */
export const createSessionStore = () => {
  let accessToken = null;
  let refreshHandler = null;
  let refreshInFlight = null;

  return {
    getAccessToken: () => accessToken,
    setAccessToken: (token) => {
      accessToken = token;
    },
    setRefreshHandler: (handler) => {
      refreshHandler = handler;
    },
    // Refresh once, even if many requests ask at the same time
    refreshAccessToken: () => {
      if (!refreshHandler) return Promise.resolve(null);
      refreshInFlight ??= refreshHandler().finally(() => {
        refreshInFlight = null;
      });
      return refreshInFlight;
    },
  };
};
