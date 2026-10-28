/**
 * HeroCard — Sunrise gradient card at the top of Home with the SaathMein promise.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { cardShadow, gradients, radius } from '@/theme/tokens';
import { enterUp } from '@/utils/animations';

/**
 * @returns Gradient hero card
 */
export function HeroCard() {
  const { t } = useTranslation();

  return (
    <Animated.View entering={enterUp(0)} style={cardShadow}>
      <LinearGradient
        colors={gradients.sunrise}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: radius.card }}
      >
        <View className="p-5">
          <AppText variant="title" color="white">
            {t('home.heroTitle')}
          </AppText>
          <AppText variant="body" color="whiteSoft" className="mt-2">
            {t('home.heroBody')}
          </AppText>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}
