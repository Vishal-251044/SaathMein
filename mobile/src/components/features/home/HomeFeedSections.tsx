/**
 * HomeFeedSections — ranked home sections for my city (DIS-1): banners, Featured, Near
 * you, Ending soon, Almost full, Seller deals, Trending. Skeleton while loading, retry on
 * error, and an empty state with "Start a group" when the city has no live groups yet.
 */
import type { Href } from 'expo-router';
import { RefreshCw, UsersRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { EmptyState } from '@/components/features/EmptyState';
import { BannerCarousel } from '@/components/features/home/BannerCarousel';
import { GroupRail } from '@/components/features/home/GroupRail';
import { Button } from '@/components/ui/Button';
import { useHomeFeed } from '@/hooks/useDiscovery';
import type { HomeSectionKey } from '@/types/feed';
import { getErrorMessageKey } from '@/utils/errorMessages';

/** "See all" destination per section (browse screen presets). */
const SEE_ALL: Partial<Record<HomeSectionKey, Href>> = {
  near_you: { pathname: '/browse', params: { preset: 'near_you' } },
  ending_soon: { pathname: '/browse', params: { preset: 'ending_soon' } },
  almost_full: { pathname: '/browse', params: { preset: 'almost_full' } },
  seller_deals: { pathname: '/browse', params: { preset: 'seller_deals' } },
};

/** @returns Home sections */
export function HomeFeedSections() {
  const { t } = useTranslation();
  const feed = useHomeFeed();

  if (feed.isPending) {
    return (
      <View className="mt-8 gap-4" accessibilityLabel={t('common.loading')}>
        <View className="h-36 rounded-card bg-bg-band" />
        <View className="h-6 w-40 rounded-full bg-bg-band" />
        <View className="h-40 rounded-card bg-bg-band" />
      </View>
    );
  }
  if (feed.isError && !feed.data) {
    return (
      <EmptyState
        icon={RefreshCw}
        title={t('errors.generic')}
        body={t(getErrorMessageKey(feed.error))}
        className="mt-8"
        action={
          <Button label={t('common.retry')} variant="secondary" onPress={() => feed.refetch()} />
        }
      />
    );
  }

  const { banners, sections } = feed.data;
  return (
    <View>
      {banners.length ? (
        <View className="mt-6">
          <BannerCarousel banners={banners} />
        </View>
      ) : null}
      {sections.length ? (
        sections.map((section, index) => (
          <GroupRail
            key={section.key}
            index={index}
            title={t(`home.sections.${section.key}`)}
            groups={section.groups}
            seeAllHref={SEE_ALL[section.key]}
          />
        ))
      ) : (
        <EmptyState
          icon={UsersRound}
          title={t('home.emptyTitle')}
          body={t('home.emptyBody')}
          className="mt-8"
        />
      )}
    </View>
  );
}
