/**
 * Shared Reanimated presets: durations, easings, springs and entering animations.
 * Use these instead of inline animation values. Only transform and opacity are animated.
 * Layout animations follow the phone's "reduce motion" setting (ReduceMotion.System);
 * looping effects (shimmer, sheen, float, pulse) switch themselves off with reduced motion.
 */
import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  SlideInDown,
  SlideOutUp,
  ZoomIn,
} from 'react-native-reanimated';

/** Durations in ms (fast and subtle: 150–400 ms). */
export const DURATION = { fast: 150, base: 250, slow: 400 } as const;

/** Slow loops for ambient effects (never distracting). */
export const LOOP = { shimmer: 1200, sheen: 2600, float: 2800, pulse: 1400 } as const;

/** Smooth deceleration for entrances. */
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

/** Gentle in-out for loops. */
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

/** Spring for press feedback (scale on tap). */
export const SPRING_PRESS = { damping: 18, stiffness: 400, mass: 0.6 } as const;

/** Livelier spring for the tab indicator and icons (a touch of bounce). */
export const SPRING_BOUNCY = { damping: 14, stiffness: 220, mass: 0.7 } as const;

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

/**
 * Slide in from the right, for items in horizontal rails.
 * @param index - Position in the rail
 * @returns Reanimated entering animation
 */
export function enterRight(index = 0) {
  return FadeInRight.duration(DURATION.slow)
    .delay(Math.min(index, 6) * 70)
    .easing(EASE_OUT)
    .reduceMotion(ReduceMotion.System);
}

/**
 * Pop-in for avatars and chips, staggered.
 * @param index - Position in the row
 * @returns Reanimated entering animation
 */
export function enterPopAt(index = 0) {
  return ZoomIn.duration(DURATION.base)
    .delay(index * 50)
    .springify()
    .damping(14)
    .reduceMotion(ReduceMotion.System);
}

/** Plain fade entrance. */
export const enterFade = FadeIn.duration(DURATION.base).reduceMotion(ReduceMotion.System);

/** Plain fade exit. */
export const exitFade = FadeOut.duration(DURATION.fast).reduceMotion(ReduceMotion.System);

/** New lowest auction price: the number drops in from above (AUC-9). */
export const enterPriceDrop = FadeInDown.duration(DURATION.base)
  .easing(EASE_OUT)
  .reduceMotion(ReduceMotion.System);

/** Small pop for badges such as "New lowest price" or "Tier unlocked". */
export const enterPop = ZoomIn.duration(DURATION.base).reduceMotion(ReduceMotion.System);

/** Counter ticks: the new value rolls up from below, the old one leaves upwards. */
export const tickIn = SlideInDown.duration(DURATION.base)
  .easing(EASE_OUT)
  .reduceMotion(ReduceMotion.System);
export const tickOut = SlideOutUp.duration(DURATION.fast).reduceMotion(ReduceMotion.System);

/** Smooth re-layout when items are added or removed. */
export const layoutSmooth = LinearTransition.duration(DURATION.base)
  .easing(EASE_OUT)
  .reduceMotion(ReduceMotion.System);
