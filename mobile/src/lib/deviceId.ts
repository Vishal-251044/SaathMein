/**
 * Stable, random id for this app install. Sent with OTP requests and logins so the API
 * can apply per-device OTP limits (ACC-4) and show sessions per device.
 * It is not a hardware id and is reset when the app is reinstalled.
 */
import { randomUUID } from 'expo-crypto';

import { getItem, setItem, STORAGE_KEYS } from './secureStorage';

let cachedDeviceId: string | null = null;

/**
 * Get (or create once) the install id.
 * @returns UUID string
 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  const stored = await getItem(STORAGE_KEYS.DEVICE_ID);
  if (stored) {
    cachedDeviceId = stored;
    return stored;
  }

  const created = randomUUID();
  await setItem(STORAGE_KEYS.DEVICE_ID, created);
  cachedDeviceId = created;
  return created;
}
