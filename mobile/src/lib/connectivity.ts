/**
 * Connectivity — knows whether the app can reach the SaathMein API, without an extra
 * native module: a request that fails with no response marks the app offline, any
 * response marks it online. While offline the banner shows, requests fail fast (queries use
 * networkMode "always") and screens keep their saved data; the API is probed every 15 s and
 * when it answers, TanStack Query refetches stale screens (refetch on reconnect). Also tells
 * TanStack Query when the app returns to the foreground.
 */
import { focusManager, onlineManager } from '@tanstack/react-query';
import axios, { isAxiosError } from 'axios';
import { AppState, type AppStateStatus } from 'react-native';

import { API_URL } from '@/utils/constants';

const PROBE_EVERY_MS = 15_000;
const PROBE_TIMEOUT_MS = 5_000;

let probeTimer: ReturnType<typeof setInterval> | null = null;

/** Ask the API's health endpoint whether we are back online. */
async function probe(): Promise<void> {
  try {
    await axios.get(`${API_URL}/health`, { timeout: PROBE_TIMEOUT_MS });
    markOnline();
  } catch (error) {
    // Any HTTP answer (even 503) means the network works
    if (isAxiosError(error) && error.response) markOnline();
  }
}

/** A request got an answer from the server. */
export function markOnline(): void {
  if (probeTimer) {
    clearInterval(probeTimer);
    probeTimer = null;
  }
  if (!onlineManager.isOnline()) onlineManager.setOnline(true);
}

/** A request failed without any answer (no network, server unreachable). */
export function markOffline(): void {
  if (onlineManager.isOnline()) onlineManager.setOnline(false);
  if (!probeTimer) probeTimer = setInterval(probe, PROBE_EVERY_MS);
}

/** Check right now (the offline banner's "Try again"). */
export function checkConnectionNow(): Promise<void> {
  return probe();
}

/**
 * Subscribe to online / offline changes.
 * @returns Unsubscribe
 */
export function subscribeOnline(listener: (online: boolean) => void): () => void {
  return onlineManager.subscribe(listener);
}

/** @returns true while the API is reachable */
export function isOnline(): boolean {
  return onlineManager.isOnline();
}

// The app coming back to the foreground counts as "focus" (refetch stale screens)
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    handleFocus(state === 'active');
  });
  return () => subscription.remove();
});
