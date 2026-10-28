/**
 * Home tab. Day 1: brand header, promise card, how it works and an empty state.
 * Real sections (Groups for You, Ending soon, Almost full...) arrive on Day 11.
 */
import { UsersRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { EmptyState } from '@/components/features/EmptyState';
import { HeroCard } from '@/components/features/HeroCard';
import { HowItWorksSteps } from '@/components/features/HowItWorksSteps';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { LogoMark } from '@/components/ui/LogoMark';
import { enterFade } from '@/utils/animations';

/**
 * @returns Home screen
 */
export default function HomeScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <Animated.View entering={enterFade} className="flex-row items-center gap-3 pb-5 pt-3">
        <LogoMark size={44} />
        <View className="flex-1">
          <AppText variant="heading" accessibilityRole="header">
            {t('home.greeting')}
          </AppText>
          <AppText variant="caption">{t('home.subtitle')}</AppText>
        </View>
      </Animated.View>

      <HeroCard />

      <AppText variant="heading" className="mb-3 mt-8">
        {t('home.howTitle')}
      </AppText>
      <HowItWorksSteps />

      <EmptyState
        icon={UsersRound}
        title={t('home.emptyTitle')}
        body={t('home.emptyBody')}
        className="mt-8"
      />
    </Screen>
  );
}
