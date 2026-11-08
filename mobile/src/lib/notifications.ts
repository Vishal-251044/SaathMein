/**
 * Push notifications (Expo Notifications + FCM, LIV-3): permission, the Android channel,
 * this phone's Expo push token (sent to the API after login, removed on logout) and
 * opening the right screen when a notification is tapped.
 * Needs the EAS project id (`eas init`) and the FCM key uploaded to Expo; without them
 * the app works and simply does not register for push.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { registerPushToken, removePushToken } from '@/services/notification.service';
import { brand } from '@/theme/tokens';

let currentToken: string | null = null;

// Show notifications that arrive while the app is open (the in-app centre also updates)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** @returns The EAS project id, or null before `eas init` */
function projectId(): string | null {
  const fromEas = (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
  const fromExtra = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
    ?.eas?.projectId;
  return fromEas ?? fromExtra ?? null;
}

/**
 * Ask permission, create the Android channel and send this phone's token to the API.
 * Safe to call on every app start after login.
 * @returns The Expo push token, or null when push is not possible
 */
export async function registerForPush(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null; // emulators cannot receive push
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'SaathMein',
        importance: AndroidImportance.HIGH,
        lightColor: brand.primary,
      });
    }
    const existing = await Notifications.getPermissionsAsync();
    const status = existing.granted
      ? existing.status
      : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const id = projectId();
    if (!id) return null;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    currentToken = data;
    await registerPushToken(data, Platform.OS === 'ios' ? 'ios' : 'android');
    return data;
  } catch {
    return null; // never block the app because push could not be set up
  }
}

/** Remove this phone's token from the account (before logging out). */
export async function unregisterPush(): Promise<void> {
  if (!currentToken) return;
  await removePushToken(currentToken).catch(() => {});
  currentToken = null;
}

/**
 * The app route a notification should open (`data.url`, e.g. /group/<id>).
 * @param data - Notification data from the API
 * @returns Route or null
 */
export function routeFromNotificationData(data: unknown): string | null {
  const url = (data as { url?: unknown } | null)?.url;
  return typeof url === 'string' && url.startsWith('/') ? url : null;
}
