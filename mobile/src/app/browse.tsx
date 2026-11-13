/**
 * Browse groups (DIS-4): every live public group in my city with filters — category, area,
 * price range, group size, time left, seller-led or buyer-led — and sort. Opened from the
 * home "See all" links with a preset. Infinite list, pull to refresh, skeleton / error /
 * empty states. Community groups never appear (GRP-6).
 */
import { useLocalSearchParams } from 'expo-router';
import { SlidersHorizontal, SearchX } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/features/EmptyState';
import { GroupCard } from '@/components/features/GroupCard';
import { GroupFilterSheet } from '@/components/features/home/GroupFilterSheet';
import { StackHeader } from '@/components/layout/StackHeader';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useBrowseGroups } from '@/hooks/useDiscovery';
import { useAuthStore } from '@/stores/auth.store';
import type { GroupFilters } from '@/types/feed';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { Skeleton } from '@/components/animations/Skeleton';
import { brand } from '@/theme/tokens';

type Preset = 'near_you' | 'ending_soon' | 'almost_full' | 'seller_deals';

/** Starting filters for a home section's "See all". */
const presetFilters = (preset: Preset | undefined, area: string | undefined): GroupFilters => {
  if (preset === 'near_you' && area) return { area };
  if (preset === 'ending_soon') return { endsWithinHours: 72, sort: 'ending_soon' };
  if (preset === 'almost_full') return { sort: 'filling' };
  if (preset === 'seller_deals') return { type: 'seller_led' };
  return {};
};

/** @returns Browse screen */
export default function BrowseScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const { preset, type, categoryId } = useLocalSearchParams<{
    preset?: Preset;
    type?: 'seller_led' | 'buyer_led';
    categoryId?: string;
  }>();
  const [filters, setFilters] = useState<GroupFilters>(() => ({
    ...presetFilters(preset, user?.area ?? undefined),
    ...(type ? { type } : {}),
    ...(categoryId ? { categoryId } : {}),
  }));
  const [sheetOpen, setSheetOpen] = useState(false);
  const query = useBrowseGroups(filters);
  const groups = useMemo(
    () => query.data?.pages.flatMap((page) => page.groups) ?? [],
    [query.data],
  );
  const activeCount = Object.keys(filters).filter((key) => key !== 'sort').length;

  return (
    <View className="flex-1 bg-bg">
      <StackHeader title={t('browse.title')} />
      <View className="flex-row items-center justify-between gap-3 px-4 pb-2 pt-1">
        <AppText variant="caption" className="flex-1">
          {query.data
            ? t('browse.count', { count: query.data.pages[0]?.meta.total ?? groups.length })
            : ' '}
        </AppText>
        <Button
          label={
            activeCount ? t('browse.filtersCount', { count: activeCount }) : t('browse.filters')
          }
          icon={SlidersHorizontal}
          variant="secondary"
          onPress={() => setSheetOpen(true)}
        />
      </View>

      {query.isPending ? (
        <View className="gap-3 px-4 pt-2" accessibilityLabel={t('common.loading')}>
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-32 rounded-card" />
          ))}
        </View>
      ) : query.isError && !query.data ? (
        <View className="px-4 pt-6">
          <EmptyState
            icon={SearchX}
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
          data={groups}
          keyExtractor={(group) => group.id}
          contentContainerStyle={{ gap: 12, padding: 16, paddingBottom: 32 + insets.bottom }}
          renderItem={({ item }) => <GroupCard group={item} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
          }}
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
          ListEmptyComponent={
            <EmptyState
              icon={SearchX}
              title={t('browse.emptyTitle')}
              body={t('browse.emptyBody')}
              action={
                activeCount ? (
                  <Button
                    label={t('browse.clear')}
                    variant="secondary"
                    onPress={() => setFilters({})}
                  />
                ) : undefined
              }
            />
          }
        />
      )}

      <GroupFilterSheet
        visible={sheetOpen}
        value={filters}
        onClose={() => setSheetOpen(false)}
        onApply={(next) => {
          setFilters(next);
          setSheetOpen(false);
        }}
      />
    </View>
  );
}
