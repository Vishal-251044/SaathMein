/**
 * HeroCard — the Sunrise gradient card at the top of Home: the SaathMein promise, three
 * quick steps (join → dealers bid → everyone saves) and a "Find a group" action.
 * Motion: a soft light sheen sweeps across now and then, decorative circles and the
 * "people together" badge drift slowly, the steps pop in one by one. All of it is transform
 * or opacity only and stops with reduce motion.
 */
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Gavel, HandCoins, UserRound, UsersRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Float, Sheen } from '@/components/animations/Effects';
import { PressableScale } from '@/components/animations/PressableScale';
import { AppText } from '@/components/ui/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';
import { tapLight } from '@/lib/haptics';
import { brand, cardShadow, gradients, radius } from '@/theme/tokens';
import { enterPopAt, enterUp } from '@/utils/animations';

const STEPS = [
  { key: 'home.heroStep1', icon: UsersRound },
  { key: 'home.heroStep2', icon: Gavel },
  { key: 'home.heroStep3', icon: HandCoins },
] as const;

/** Three overlapping people in white circles: "buy together". */
function TogetherBadge() {
  return (
    <View className="flex-row items-center" accessibilityElementsHidden>
      {[0, 1, 2].map((index) => (
        <View
          key={index}
          className="h-10 w-10 items-center justify-center rounded-full border-2 border-white/80 bg-white/25"
          style={{ marginLeft: index === 0 ? 0 : -12 }}
        >
          <UserRound size={18} color={brand.white} strokeWidth={2.2} />
        </View>
      ))}
    </View>
  );
}

/**
 * @returns Gradient hero card
 */
export function HeroCard() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  return (
    <Animated.View entering={enterUp(0)} style={cardShadow}>
      <View style={{ borderRadius: radius.card, overflow: 'hidden' }}>
        <LinearGradient colors={gradients.sunrise} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          {/* Decorative circles (behind the text) */}
          <Float distance={8} style={{ position: 'absolute', right: -40, top: -50 }}>
            <View className="h-44 w-44 rounded-full bg-white/10" />
          </Float>
          <Float distance={6} delay={900} style={{ position: 'absolute', right: 40, bottom: -60 }}>
            <View className="h-32 w-32 rounded-full bg-white/10" />
          </Float>

          <View className="gap-4 p-5">
            <View className="flex-row items-start gap-3">
              <View className="flex-1">
                <AppText variant="title" color="white" accessibilityRole="header">
                  {t('home.heroTitle')}
                </AppText>
              </View>
              <Float distance={5} delay={400}>
                <TogetherBadge />
              </Float>
            </View>
            <AppText variant="body" color="whiteSoft">
              {t('home.heroBody')}
            </AppText>

            <View className="flex-row flex-wrap gap-2">
              {STEPS.map(({ key, icon: Icon }, index) => (
                <Animated.View
                  key={key}
                  entering={enterPopAt(index + 2)}
                  className="min-h-8 flex-row items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5"
                >
                  <Icon size={14} color={brand.white} strokeWidth={2.2} />
                  <AppText variant="label" color="white">
                    {t(key)}
                  </AppText>
                </Animated.View>
              ))}
            </View>

            <PressableScale
              onPress={() => {
                tapLight();
                router.push('/browse');
              }}
              accessibilityRole="button"
              accessibilityLabel={t('home.heroCta')}
              className="min-h-12 flex-row items-center justify-center gap-2 self-start rounded-full bg-white px-5"
            >
              <AppText variant="bodyStrong" color="primary">
                {t('home.heroCta')}
              </AppText>
              <ArrowRight size={18} color={colors.primaryText} strokeWidth={2.4} />
            </PressableScale>
          </View>
          <Sheen />
        </LinearGradient>
      </View>
    </Animated.View>
  );
}
