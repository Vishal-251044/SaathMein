/**
 * Dealer profile (TRU-2): verified badge, rating (includes penalties) and number of
 * reviews, member since, groups won, and reviews from buyers who completed a purchase.
 * Buyers can report the dealer or a review (TRU-3).
 */
import { useLocalSearchParams } from 'expo-router';
import { BadgeCheck, Flag, MapPin, Star, Store, Trophy } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/features/EmptyState';
import { ReportSheet } from '@/components/features/trust/ReportSheet';
import { StackHeader } from '@/components/layout/StackHeader';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useDealer, useDealerReviews } from '@/hooks/useTrust';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { ReportTarget } from '@/types/trust';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { Skeleton } from '@/components/animations/Skeleton';

/** @returns Dealer profile screen */
export default function DealerScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dealer = useDealer(id);
  const reviews = useDealerReviews(id);
  const [reporting, setReporting] = useState<{ type: ReportTarget; id: string } | null>(null);
  const list = useMemo(
    () => reviews.data?.pages.flatMap((page) => page.reviews) ?? [],
    [reviews.data],
  );
  const since = dealer.data
    ? new Date(dealer.data.memberSince).toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <View className="flex-1 bg-bg">
      <StackHeader title={t('dealer.title')} />
      {dealer.isPending ? (
        <View className="gap-3 p-4">
          <Skeleton className="h-32 rounded-card" />
          <Skeleton className="h-24 rounded-card" />
        </View>
      ) : dealer.isError && !dealer.data ? (
        <View className="p-4">
          <EmptyState
            icon={Store}
            title={t('errors.generic')}
            body={t(getErrorMessageKey(dealer.error))}
            action={
              <Button
                label={t('common.retry')}
                variant="secondary"
                onPress={() => dealer.refetch()}
              />
            }
          />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(review) => review.id}
          contentContainerStyle={{ gap: 12, padding: 16, paddingBottom: 32 + insets.bottom }}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (reviews.hasNextPage && !reviews.isFetchingNextPage) reviews.fetchNextPage();
          }}
          ListHeaderComponent={
            <View className="mb-2 gap-4">
              <View className="gap-2 rounded-card border border-line bg-surface p-4">
                <View className="flex-row items-center gap-2">
                  <AppText variant="title" className="flex-shrink">
                    {dealer.data.businessName}
                  </AppText>
                  {dealer.data.verified ? (
                    <BadgeCheck
                      size={20}
                      color={colors.ink}
                      strokeWidth={2}
                      accessibilityLabel={t('sellers.verified')}
                    />
                  ) : null}
                </View>
                {dealer.data.area ? (
                  <View className="flex-row items-center gap-1">
                    <MapPin size={14} color={colors.muted} strokeWidth={2} />
                    <AppText variant="caption">{dealer.data.area}</AppText>
                  </View>
                ) : null}
                <View className="flex-row flex-wrap gap-x-5 gap-y-2 border-t border-line pt-3">
                  <View className="flex-row items-center gap-1">
                    <Star size={16} color={colors.warning} strokeWidth={2} />
                    <AppText variant="bodyStrong">
                      {dealer.data.rating != null
                        ? dealer.data.rating.toFixed(1)
                        : t('dealer.noRating')}
                    </AppText>
                    <AppText variant="caption">
                      {t('dealer.reviews', { count: dealer.data.ratingCount })}
                    </AppText>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Trophy size={16} color={colors.muted} strokeWidth={2} />
                    <AppText variant="caption" color="ink">
                      {t('dealer.groupsWon', { count: dealer.data.groupsWon })}
                    </AppText>
                  </View>
                  <AppText variant="caption">{t('dealer.since', { date: since })}</AppText>
                </View>
              </View>
              <Button
                label={t('dealer.report')}
                icon={Flag}
                variant="ghost"
                onPress={() => setReporting({ type: 'seller', id: dealer.data.id })}
              />
              <AppText variant="heading">{t('dealer.reviewsTitle')}</AppText>
            </View>
          }
          renderItem={({ item }) => (
            <View className="gap-1 rounded-card border border-line bg-surface p-4">
              <View className="flex-row items-center justify-between gap-2">
                <View
                  className="flex-row items-center gap-1"
                  accessible
                  accessibilityLabel={t('dealer.starsA11y', { count: item.rating })}
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star
                      key={value}
                      size={14}
                      strokeWidth={1.75}
                      color={value <= item.rating ? colors.warning : colors.muted}
                      fill={value <= item.rating ? colors.warning : 'transparent'}
                    />
                  ))}
                </View>
                <Pressable
                  onPress={() => setReporting({ type: 'review', id: item.id })}
                  accessibilityRole="button"
                  accessibilityLabel={t('dealer.reportReview')}
                  className="h-12 w-12 items-center justify-center"
                >
                  <Flag size={16} color={colors.muted} strokeWidth={2} />
                </Pressable>
              </View>
              {item.text ? <AppText variant="body">{item.text}</AppText> : null}
              <AppText variant="caption">
                {item.buyerFirstName ?? t('group.someone')} ·{' '}
                {new Date(item.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </AppText>
            </View>
          )}
          ListEmptyComponent={
            reviews.isPending ? undefined : (
              <EmptyState
                icon={Star}
                title={t('dealer.noReviewsTitle')}
                body={t('dealer.noReviewsBody')}
              />
            )
          }
        />
      )}
      {reporting ? (
        <ReportSheet
          visible
          onClose={() => setReporting(null)}
          targetType={reporting.type}
          targetId={reporting.id}
        />
      ) : null}
    </View>
  );
}
