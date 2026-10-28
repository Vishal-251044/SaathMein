/**
 * HowItWorksSteps — the three-step SaathMein loop: join, dealers bid, everyone saves.
 */
import { BadgeIndianRupee, Gavel, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { brand } from '@/theme/tokens';
import { enterUp } from '@/utils/animations';

const STEPS = [
  { key: 'home.stepJoin', icon: Users },
  { key: 'home.stepBid', icon: Gavel },
  { key: 'home.stepSave', icon: BadgeIndianRupee },
] as const;

/**
 * @returns Numbered list of the three steps
 */
export function HowItWorksSteps() {
  const { t } = useTranslation();

  return (
    <View className="gap-3">
      {STEPS.map(({ key, icon: Icon }, index) => (
        <Animated.View
          key={key}
          entering={enterUp(index + 1)}
          className="flex-row items-center gap-4 rounded-card border border-line bg-surface p-4"
        >
          <View className="h-12 w-12 items-center justify-center rounded-button bg-bg-band">
            <Icon size={22} color={brand.primary} strokeWidth={2} />
          </View>
          <View className="flex-1">
            <AppText variant="label" mono>
              {`0${index + 1}`}
            </AppText>
            <AppText variant="bodyStrong" className="mt-0.5">
              {t(key)}
            </AppText>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}
