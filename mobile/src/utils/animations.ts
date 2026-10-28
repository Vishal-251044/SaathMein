/**
 * Shared Reanimated presets: durations, easings, springs and entering animations.
 * Use these instead of inline animation values. Only transform and opacity are animated.
 * Layout animations follow the phone's "reduce motion" setting (ReduceMotion.System).
 */
import { Easing, FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';

/** Durations in ms (fast and subtle: 150–400 ms). */
export const DURATION = { fast: 150, base: 250, slow: 400 } as const;

/** Smooth deceleration for entrances. */
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

/** Spring for press feedback (scale on tap). */
export const SPRING_PRESS = { damping: 18, stiffness: 400, mass: 0.6 } as const;

/** Scale a pressable shrinks to while pressed. */
export const PRESS_SCALE = 0.97;

/**
 * Fade + rise entrance for list items and sections.
 * @param index - Position in a list, used to stagger items
 * @param stagger - Delay between items in ms
 * @returns Reanimated entering animation
 */
export function enterUp(index = 0, stagger = 60) {
  return FadeInDown.duration(DURATION.slow)
    .delay(index * stagger)
    .easing(EASE_OUT)
    .reduceMotion(ReduceMotion.System);
}

/** Plain fade entrance. */
export const enterFade = FadeIn.duration(DURATION.base).reduceMotion(ReduceMotion.System);
