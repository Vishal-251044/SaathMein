/**
 * Notification centre (LIV-4): newest first, unread highlighted, tap to open the related
 * screen (and mark read), "Mark all as read", pull to refresh, empty / error states.
 */
import { type Href, router } from 'expo-router';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { PressableScale } from '@/components/animations/PressableScale';
import { EmptyState } from '@/components/features/EmptyState';
import { StackHeader } from '@/components/layout/StackHeader';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useMarkNotificationsRead, useNotificationList } from '@/hooks/useNotifications';
import { useThemeColors } from '@/hooks/useThemeColors';
import { routeFromNotificationData } from '@/lib/notifications';
import { brand } from '@/theme/tokens';
import type { AppNotification } from '@/types/live';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { cx } from '@/utils/genericFunctions';

/** One notification row. */
function NotificationRow({ item, onOpen }: { item: AppNotification; onOpen: () => void }) {
  const { i18n } = useTranslation();
  const { colors } = useThemeColors();
  const locale = i18n.language === 'en' ? 'en-IN' : `${i18n.language}-IN`;
  return (
    <PressableScale
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.body}`}
      className={cx(
        'flex-row gap-3 rounded-card border p-4',
        item.read ? 'border-line bg-surface' : 'border-primary/30 bg-primary/5',
      )}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-bg-band">
        <Bell size={18} color={item.read ? colors.muted : brand.primary} strokeWidth={2} />
      </View>
      <View className="flex-1 gap-0.5">
        <AppText variant="bodyStrong">{item.title}</AppText>
        <AppText variant="body" color="muted">
          {item.body}
        </AppText>
        <AppText variant="caption">
          {new Date(item.createdAt).toLocaleString(locale, {
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </AppText>
      </View>
      {!item.read ? (
        <View className="mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" accessibilityLabel="unread" />
      ) : null}
    </PressableScale>
  );
}

/**
 * @returns Notification centre screen
 */
export default function NotificationsScreen() {
  const { t } = useTranslation();
  const query = useNotificationList();
  const markRead = useMarkNotificationsRead();
  const items = query.data?.pages.flatMap((page) => page.notifications) ?? [];
  const unread = query.data?.pages[0]?.unreadCount ?? 0;

  const open = (item: AppNotification) => {
    if (!item.read) markRead.mutate({ ids: [item.id] });
    const route = routeFromNotificationData(item.data);
    if (route) router.push(route as Href);
  };

  return (
    <View className="flex-1 bg-bg">
      <StackHeader title={t('notifications.title')} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <NotificationRow item={item} onOpen={() => open(item)} />}
        ItemSeparatorComponent={() => <View className="h-3" />}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 32,
          width: '100%',
          maxWidth: 640,
          alignSelf: 'center',
        }}
        ListHeaderComponent={
          unread > 0 ? (
            <View className="mb-3 flex-row items-center justify-between">
              <AppText variant="caption">{t('notifications.unread', { count: unread })}</AppText>
              <Button
                label={t('notifications.markAll')}
                icon={CheckCheck}
                variant="ghost"
                loading={markRead.isPending}
                onPress={() => markRead.mutate({ all: true })}
              />
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          query.isPending ? (
            <View className="gap-3" accessibilityLabel={t('common.loading')}>
              {[0, 1, 2].map((key) => (
                <View key={key} className="h-20 rounded-card bg-bg-band" />
              ))}
            </View>
          ) : query.isError ? (
            <EmptyState
              icon={Bell}
              title={t('errors.generic')}
              body={t(getErrorMessageKey(query.error))}
              action={
                <Button
                  label={t('common.retry')}
                  icon={RefreshCw}
                  variant="secondary"
                  onPress={() => query.refetch()}
                />
              }
            />
          ) : (
            <EmptyState
              icon={Bell}
              title={t('notifications.emptyTitle')}
              body={t('notifications.emptyBody')}
            />
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator className="py-6" color={brand.primary} />
          ) : undefined
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => {
          query.refetch();
        }}
      />
    </View>
  );
}
