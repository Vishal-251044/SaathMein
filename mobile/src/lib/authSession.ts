/**
 * Auth session plumbing shared by the API client and the auth store:
 * - the access token lives in memory only (it expires in 15 minutes),
 * - the refresh token lives in secure storage,
 * - refreshes are single-flight: many 401s at once trigger one refresh.
 * The auth store registers the refresh / session-ended handlers at startup.
 */

let accessToken: string | null = null;
let refreshHandler: (() => Promise<string | null>) | null = null;
let refreshInFlight: Promise<string | null> | null = null;

/** @returns Current access token, or null when signed out */
export function getAccessToken(): string | null {
  return accessToken;
}

/** @param token - New access token (null on sign-out) */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/**
 * Register the function that exchanges the stored refresh token for a new access token.
 * @param handler - Resolves to a new access token, or null when the session has ended
 */
export function setRefreshHandler(handler: (() => Promise<string | null>) | null): void {
  refreshHandler = handler;
}

/**
 * Refresh the access token once, even if several requests ask at the same time.
 * @returns New access token, or null when signed out
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshHandler) return Promise.resolve(null);
  refreshInFlight ??= refreshHandler().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}
