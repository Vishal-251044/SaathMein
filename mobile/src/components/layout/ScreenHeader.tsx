/**
 * ScreenHeader — large title at the top of a tab screen, with an optional trailing element.
 */
import { type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { enterFade } from '@/utils/animations';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Element shown on the right of the title (badge, button). */
  trailing?: ReactNode;
}

/**
 * @param props.title - Screen title (already translated)
 * @param props.subtitle - Optional line under the title
 */
export function ScreenHeader({ title, subtitle, trailing }: ScreenHeaderProps) {
  return (
    <Animated.View
      entering={enterFade}
      className="flex-row items-center justify-between gap-3 pb-4 pt-3"
    >
      <View className="flex-1">
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" className="mt-1">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing}
    </Animated.View>
  );
}
