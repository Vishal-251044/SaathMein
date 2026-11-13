/**
 * My disputes (TRU-4, /my-disputes): every dispute I opened, newest first, with status.
 */
import { router } from 'expo-router';
import { ChevronRight, Scale } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/animations/PressableScale';
import { EmptyState } from '@/components/features/EmptyState';
import { DisputeStatusPill } from '@/components/features/trust/DisputeStatusPill';
import { StackHeader } from '@/components/layout/StackHeader';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useMyDisputes } from '@/hooks/useTrust';
import { useThemeColors } from '@/hooks/useThemeColors';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { Skeleton } from '@/components/animations/Skeleton';
import { brand } from '@/theme/tokens';

/** @returns My disputes screen */
export default function MyDisputesScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const query = useMyDisputes();
  const disputes = useMemo(
    () => query.data?.pages.flatMap((page) => page.disputes) ?? [],
    [query.data],
  );

  return (
    <View className="flex-1 bg-bg">
      <StackHeader title={t('dispute.listTitle')} />
      {query.isPending ? (
        <View className="gap-3 p-4">
          <Skeleton className="h-24 rounded-card" />
          <Skeleton className="h-24 rounded-card" />
        </View>
      ) : query.isError && !query.data ? (
        <View className="p-4">
          <EmptyState
            icon={Scale}
            title={t('errors.generic')}
            body={t(getErrorMessageKey(query.error))}
            action={
              <Button
                label={t('common.retry')}
                variant="secondary"
                onPress={() => query.refetch()}
              />
            }
          />
        </View>
      ) : (
        <FlatList
          data={disputes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 12, padding: 16, paddingBottom: 32 + insets.bottom }}
          refreshControl={
            <RefreshControl
              colors={[brand.primary]}
              tintColor={brand.primary}
              refreshing={query.isRefetching}
              onRefresh={() => {
                query.refetch();
              }}
            />
          }
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
          }}
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => router.push({ pathname: '/disputes/[id]', params: { id: item.id } })}
              accessibilityRole="button"
              accessibilityLabel={t(`dispute.types.${item.type}`)}
              className="flex-row items-center gap-3 rounded-card border border-line bg-surface p-4"
            >
              <View className="flex-1 gap-1">
                <AppText variant="bodyStrong">{t(`dispute.types.${item.type}`)}</AppText>
                <AppText variant="caption" numberOfLines={2}>
                  {item.description}
                </AppText>
                <DisputeStatusPill status={item.status} />
              </View>
              <ChevronRight size={20} color={colors.muted} strokeWidth={2} />
            </PressableScale>
          )}
          ListEmptyComponent={
            <EmptyState
              icon={Scale}
              title={t('dispute.emptyTitle')}
              body={t('dispute.emptyBody')}
            />
          }
        />
      )}
    </View>
  );
}
