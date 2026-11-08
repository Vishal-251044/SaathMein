/**
 * Notification service — /notifications: the in-app centre (read / unread) and this
 * phone's Expo push token.
 */
import type { AppNotification } from '@/types/live';

import { api, type ApiEnvelope, unwrap } from './api';

export interface NotificationPage {
  notifications: AppNotification[];
  unreadCount: number;
  meta: { page: number; hasNextPage: boolean };
}

/** One page of notifications, newest first. */
export async function getNotifications(page = 1): Promise<NotificationPage> {
  const response = await api.get<
    ApiEnvelope<{ notifications: AppNotification[]; unreadCount: number }>
  >('/notifications', { params: { page, limit: 20 } });
  return {
    ...response.data.data,
    meta: response.data.meta as NotificationPage['meta'],
  };
}

/** Mark some or all as read. @returns Unread count left */
export async function markNotificationsRead(input: {
  ids?: string[];
  all?: boolean;
}): Promise<number> {
  return (await unwrap<{ unreadCount: number }>(api.post('/notifications/read', input)))
    .unreadCount;
}

/** Save this phone's push token for the logged-in user. */
export async function registerPushToken(token: string, platform: 'android' | 'ios'): Promise<void> {
  await api.post('/notifications/push-token', { token, platform });
}

/** Forget this phone's push token (logout). */
export async function removePushToken(token: string): Promise<void> {
  await api.delete('/notifications/push-token', { data: { token } });
}
