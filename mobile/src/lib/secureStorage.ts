/**
 * Secure storage (Android Keystore-backed via expo-secure-store).
 * The refresh token and other persisted values live here — never in AsyncStorage.
 * On web (dev preview only) SecureStore is unavailable, so values are kept in memory.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Every key the app stores. Keep this list small and explicit. */
export const STORAGE_KEYS = {
  REFRESH_TOKEN: 'sm.auth.refreshToken',
  DEVICE_ID: 'sm.device.id',
  LANGUAGE: 'sm.settings.language',
  RECENT_SEARCHES: 'sm.search.recent',
} as const;

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

const memoryFallback = new Map<string, string>();
const isSecureStoreAvailable = Platform.OS !== 'web';

/**
 * Read a value.
 * @param key - Storage key
 * @returns Stored value, or null when missing or unreadable
 */
export async function getItem(key: StorageKey): Promise<string | null> {
  if (!isSecureStoreAvailable) return memoryFallback.get(key) ?? null;
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    // Keystore can be reset (e.g. new lock screen); treat as "not stored"
    return null;
  }
}

/**
 * Save a value.
 * @param key - Storage key
 * @param value - Value to store
 */
export async function setItem(key: StorageKey, value: string): Promise<void> {
  if (!isSecureStoreAvailable) {
    memoryFallback.set(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

/**
 * Delete a value.
 * @param key - Storage key
 */
export async function removeItem(key: StorageKey): Promise<void> {
  if (!isSecureStoreAvailable) {
    memoryFallback.delete(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
