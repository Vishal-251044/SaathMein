/**
 * In-memory staff session (admin console).
 * The access token is kept ONLY in memory — never localStorage — so a script injected
 * into the page cannot steal a long-lived token. The refresh token is an httpOnly cookie
 * set by the API and is never visible to JavaScript.
 */

let accessToken = null;
let refreshHandler = null;
let refreshInFlight = null;

/** @returns {string|null} Current staff access token */
export const getAccessToken = () => accessToken;

/** @param {string|null} token - New access token (null on logout) */
export const setAccessToken = (token) => {
  accessToken = token;
};

/**
 * Register the function that refreshes the session (set by AdminAuthProvider).
 * @param {(() => Promise<string>)|null} handler - Resolves to a new access token
 */
export const setRefreshHandler = (handler) => {
  refreshHandler = handler;
};

/**
 * Refresh the access token once, even if many requests ask at the same time.
 * @returns {Promise<string|null>} New access token, or null if no handler is registered
 */
export const refreshAccessToken = () => {
  if (!refreshHandler) return Promise.resolve(null);
  refreshInFlight ??= refreshHandler().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
};
