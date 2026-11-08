/**
 * Notification hooks: the in-app centre (infinite list, unread badge, mark read) and the
 * app-wide setup that registers for push, keeps the badge live over the socket and opens
 * the right screen when a push is tapped.
 */
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { type Href, router } from 'expo-router';
import { useEffect } from 'react';

import { registerForPush, routeFromNotificationData } from '@/lib/notifications';
import { connectSocket, getSocket } from '@/lib/socket';
import * as notificationService from '@/services/notification.service';
import { SOCKET_EVENTS } from '@/types/live';

const NOTIFICATIONS_KEY = ['notifications'] as const;

/** @returns Infinite list of notifications (first page carries the unread count) */
export function useNotificationList(enabled = true) {
  return useInfiniteQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: ({ pageParam }) => notificationService.getNotifications(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.page + 1 : undefined,
    enabled,
  });
}

/** @returns Unread count for the bell badge */
export function useUnreadCount(enabled: boolean): number {
  const { data } = useNotificationList(enabled);
  return data?.pages[0]?.unreadCount ?? 0;
}

/** @returns Mutation `{ ids }` or `{ all: true }` */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationService.markNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}

/**
 * App-wide, while signed in: register for push, connect the socket, refresh the centre
 * on new notifications, open tapped pushes.
 * @param signedIn - Auth status
 */
export function useNotificationSetup(signedIn: boolean) {
  const queryClient = useQueryClient();
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!signedIn) return undefined;
    registerForPush();
    connectSocket();
    const socket = getSocket();
    const onNew = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    socket.on(SOCKET_EVENTS.NOTIFICATION, onNew);
    return () => {
      socket.off(SOCKET_EVENTS.NOTIFICATION, onNew);
    };
  }, [signedIn, queryClient]);

  // A push was tapped (app opened from it or brought to front)
  useEffect(() => {
    if (!signedIn || !lastResponse) return;
    const route = routeFromNotificationData(lastResponse.notification.request.content.data);
    if (route) router.push(route as Href);
    const notificationId = (
      lastResponse.notification.request.content.data as { notificationId?: string }
    )?.notificationId;
    if (notificationId)
      notificationService.markNotificationsRead({ ids: [notificationId] }).catch(() => {});
  }, [signedIn, lastResponse]);
}
