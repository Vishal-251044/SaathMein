/**
 * Skeleton — loading placeholder with a soft shimmer sweeping across (CLAUDE.md §11
 * "skeleton shimmer"). The shimmer is a translated gradient band (transform only) and
 * stops when the phone's reduce-motion setting is on.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useThemeColors } from '@/hooks/useThemeColors';
import { EASE_IN_OUT, LOOP } from '@/utils/animations';
import { cx } from '@/utils/genericFunctions';

interface SkeletonProps {
  /** Size and shape classes, e.g. "h-24 rounded-card" (background is added). */
  className?: string;
}

/**
 * @param props.className - Size / radius classes
 * @returns Shimmering placeholder block
 */
export function Skeleton({ className }: SkeletonProps) {
  const { scheme } = useThemeColors();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || !width) return undefined;
    progress.set(withRepeat(withTiming(1, { duration: LOOP.shimmer, easing: EASE_IN_OUT }), -1));
    return () => cancelAnimation(progress);
  }, [reduceMotion, width, progress]);

  const band = Math.max(80, width * 0.5);
  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: -band + progress.get() * (width + band * 2) }],
  }));
  const highlight = scheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.65)';

  return (
    <View
      className={cx('overflow-hidden bg-bg-band', className)}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {!reduceMotion && width ? (
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: band }, sweep]}
        >
          <LinearGradient
            colors={['transparent', highlight, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
