/**
 * Small reusable motion effects (CLAUDE.md §11), all transform / opacity only and all
 * switched off when the phone's reduce-motion setting is on:
 * - Sheen: a diagonal light sweep over gradient cards and the primary button
 * - Float: a slow up-and-down drift for illustrations and empty-state icons
 * - Pulse: a breathing ring around "live" dots
 * - TickerText: a value that rolls up when it changes (people counter, prices)
 */
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useEffect, useState } from 'react';
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { EASE_IN_OUT, EASE_OUT, LOOP, tickIn, tickOut } from '@/utils/animations';

/**
 * Light sweep across its parent (place inside a container with overflow hidden).
 * @param props.delay - Pause between sweeps in ms
 */
export function Sheen({ delay = 3200 }: { delay?: number }) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || !width) return undefined;
    progress.set(
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withDelay(delay, withTiming(1, { duration: LOOP.sheen / 2, easing: EASE_IN_OUT })),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(progress);
  }, [reduceMotion, width, delay, progress]);

  const band = Math.max(60, width * 0.35);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: -band * 1.5 + progress.get() * (width + band * 3) },
      { skewX: '-20deg' },
    ],
  }));

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
    >
      {!reduceMotion && width ? (
        <Animated.View
          style={[{ position: 'absolute', top: -20, bottom: -20, width: band }, style]}
        >
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.28)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * Slow vertical drift.
 * @param props.distance - Pixels up and down
 * @param props.delay - Start offset so several floats do not move in sync
 */
export function Float({
  children,
  distance = 6,
  delay = 0,
  style,
}: {
  children: ReactNode;
  distance?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return undefined;
    offset.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-distance, { duration: LOOP.float, easing: EASE_IN_OUT }),
            withTiming(0, { duration: LOOP.float, easing: EASE_IN_OUT }),
          ),
          -1,
        ),
      ),
    );
    return () => cancelAnimation(offset);
  }, [reduceMotion, distance, delay, offset]);

  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * A dot with a breathing ring, for "live" states.
 * @param props.color - Dot colour
 * @param props.size - Dot size in px
 */
export function Pulse({ color, size = 8 }: { color: string; size?: number }) {
  const reduceMotion = useReducedMotion();
  const ring = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return undefined;
    ring.set(withRepeat(withTiming(1, { duration: LOOP.pulse, easing: EASE_OUT }), -1));
    return () => cancelAnimation(ring);
  }, [reduceMotion, ring]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - ring.get()),
    transform: [{ scale: 1 + ring.get() * 1.6 }],
  }));

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden>
      {!reduceMotion ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size,
              backgroundColor: color,
            },
            ringStyle,
          ]}
        />
      ) : null}
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

/**
 * Text that rolls up when its value changes (counter ticks, CLAUDE.md §11).
 * @param props.value - The text to show; a change triggers the roll
 * @param props.textProps - AppText props (variant, mono, color)
 */
export function TickerText({
  value,
  variant = 'bodyStrong',
  mono = false,
  color,
}: {
  value: string;
  variant?: 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'caption' | 'label';
  mono?: boolean;
  color?: 'ink' | 'muted' | 'white' | 'primary' | 'savings';
}) {
  // Only real changes roll; the first value just appears (calm lists)
  const [initial] = useState(value);
  const changed = value !== initial;
  return (
    <View style={{ overflow: 'hidden' }}>
      <Animated.View
        key={value}
        entering={changed ? tickIn : undefined}
        exiting={changed ? tickOut : undefined}
      >
        <AppText variant={variant} mono={mono} color={color}>
          {value}
        </AppText>
      </Animated.View>
    </View>
  );
}
