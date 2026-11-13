/**
 * Home tab: greeting and city, ranked group sections from GET /feed/home (Day 11, DIS-1:
 * banners, featured, near you, ending soon, almost full, seller deals, trending), category
 * grid, "Popular in {city}" products, "Browse all groups" and how it works.
 * The header stays on top and gains a soft background and hairline once the page scrolls
 * (logo shrinks a little); pull down to refresh the feed.
 */
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Bell, MapPin, UsersRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryGrid } from '@/components/features/CategoryGrid';
import { HeroCard } from '@/components/features/HeroCard';
import { HowItWorksSteps } from '@/components/features/HowItWorksSteps';
import { HomeFeedSections } from '@/components/features/home/HomeFeedSections';
import { PopularProductsRail } from '@/components/features/PopularProductsRail';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { LogoMark } from '@/components/ui/LogoMark';
import { useCities } from '@/hooks/useCatalog';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useAuthStore } from '@/stores/auth.store';
import { brand } from '@/theme/tokens';
import { enterFade, enterPop } from '@/utils/animations';
import { localizedName } from '@/utils/localize';

/**
 * @returns Home screen
 */
export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useThemeColors();
  const user = useAuthStore((state) => state.user);
  const unread = useUnreadCount(true);
  const { data: cities } = useCities();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });
  // Header: hairline + background fade in over the first 24 px of scroll
  const headerBg = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, 24], [0, 1], Extrapolation.CLAMP),
  }));
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(scrollY.get(), [0, 60], [1, 0.86], Extrapolation.CLAMP) }],
  }));

  /** Pull to refresh: feed, popular products and categories. */
  const refresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['feed'] }),
      queryClient.invalidateQueries({ queryKey: ['products', 'popular'] }),
      queryClient.invalidateQueries({ queryKey: ['categories'] }),
    ]);
    setRefreshing(false);
  };

  const city = cities?.find((item) => item.id === user?.cityId);
  const area = city?.areas.find((item) => item.name === user?.area);
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const place = [localizedName(area, i18n.language), localizedName(city, i18n.language)]
    .filter(Boolean)
    .join(', ');

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <View className="z-10">
        <Animated.View
          pointerEvents="none"
          className="absolute inset-0 border-b border-line bg-surface"
          style={headerBg}
        />
        <Animated.View
          entering={enterFade}
          className="w-full max-w-[640px] flex-row items-center gap-3 self-center px-4 pb-3 pt-3"
        >
          <Animated.View style={logoStyle}>
            <LogoMark size={44} />
          </Animated.View>
          <View className="flex-1">
            <AppText variant="heading" accessibilityRole="header">
              {firstName ? t('home.greetingName', { name: firstName }) : t('home.greeting')}
            </AppText>
            {place ? (
              <View className="mt-0.5 flex-row items-center gap-1">
                <MapPin size={14} color={colors.muted} strokeWidth={2} />
                <AppText variant="caption">{place}</AppText>
              </View>
            ) : (
              <AppText variant="caption">{t('home.subtitle')}</AppText>
            )}
          </View>
          <Pressable
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel={
              unread ? t('notifications.bellUnread', { count: unread }) : t('notifications.title')
            }
            className="h-12 w-12 items-center justify-center rounded-full bg-bg-band"
          >
            <Bell size={22} color={colors.ink} strokeWidth={2} />
            {unread ? (
              <Animated.View
                key={unread}
                entering={enterPop}
                className="absolute right-1.5 top-1.5 min-w-[18px] items-center rounded-full bg-primary px-1"
              >
                <AppText variant="label" color="white">
                  {unread > 9 ? '9+' : unread}
                </AppText>
              </Animated.View>
            ) : null}
          </Pressable>
        </Animated.View>
      </View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="w-full max-w-[640px] self-center px-4 pb-8 pt-2"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={[brand.primary]}
            tintColor={brand.primary}
          />
        }
      >
        <HeroCard />

        <HomeFeedSections />

        <View className="mt-6">
          <Button
            label={t('home.browseAll')}
            icon={UsersRound}
            variant="secondary"
            onPress={() => router.push('/browse')}
          />
        </View>

        <AppText variant="heading" className="mb-3 mt-8">
          {t('home.browseCategories')}
        </AppText>
        <CategoryGrid />

        <PopularProductsRail
          cityName={localizedName(city, i18n.language) || t('catalog.yourCity')}
        />

        <AppText variant="heading" className="mb-3 mt-8">
          {t('home.howTitle')}
        </AppText>
        <HowItWorksSteps />
      </Animated.ScrollView>
    </View>
  );
}
