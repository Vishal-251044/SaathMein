/**
 * Home tab. Day 3: greeting, the user's city, promise card, chosen interests (placeholder
 * until real sections arrive on Day 11) and how it works.
 */
import { MapPin, UsersRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { EmptyState } from '@/components/features/EmptyState';
import { HeroCard } from '@/components/features/HeroCard';
import { HowItWorksSteps } from '@/components/features/HowItWorksSteps';
import { InterestsSummaryCard } from '@/components/features/InterestsSummaryCard';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { LogoMark } from '@/components/ui/LogoMark';
import { useCities } from '@/hooks/useCatalog';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useAuthStore } from '@/stores/auth.store';
import { enterFade } from '@/utils/animations';
import { localizedName } from '@/utils/localize';

/**
 * @returns Home screen
 */
export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useThemeColors();
  const user = useAuthStore((state) => state.user);
  const { data: cities } = useCities();

  const city = cities?.find((item) => item.id === user?.cityId);
  const area = city?.areas.find((item) => item.name === user?.area);
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const place = [localizedName(area, i18n.language), localizedName(city, i18n.language)]
    .filter(Boolean)
    .join(', ');

  return (
    <Screen>
      <Animated.View entering={enterFade} className="flex-row items-center gap-3 pb-5 pt-3">
        <LogoMark size={44} />
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
      </Animated.View>

      <HeroCard />

      {user ? (
        <View className="mt-6">
          <InterestsSummaryCard interests={user.interests} />
        </View>
      ) : null}

      <EmptyState
        icon={UsersRound}
        title={t('home.emptyTitle')}
        body={t('home.emptyBody')}
        className="mt-6"
      />

      <AppText variant="heading" className="mb-3 mt-8">
        {t('home.howTitle')}
      </AppText>
      <HowItWorksSteps />
    </Screen>
  );
}
