/**
 * PressableScale — Pressable with a spring "press down" scale (tap feedback).
 * Skips the animation when the phone's reduce-motion setting is on.
 */
import { type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { PRESS_SCALE, SPRING_PRESS } from '@/utils/animations';

interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * @param props.children - Content of the pressable
 * @param props.className - Classes for the animated wrapper
 */
export function PressableScale({
  children,
  className,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  // .get()/.set() instead of .value keeps shared values compatible with the React Compiler
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      onPressIn={(event) => {
        if (!reduceMotion) scale.set(withSpring(PRESS_SCALE, SPRING_PRESS));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, SPRING_PRESS));
        onPressOut?.(event);
      }}
      {...rest}
    >
      <Animated.View className={className} style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
