/**
 * Shared Framer Motion presets: durations, easings and variants.
 * Use these everywhere instead of writing animation values inline.
 * Only transform and opacity are animated (60 fps).
 */

/** Durations in seconds (keep animations fast and subtle: 150–400 ms). */
export const DURATION = Object.freeze({ fast: 0.15, base: 0.25, slow: 0.4 });

/** Easing curves. */
export const EASE = Object.freeze({
  out: [0.22, 1, 0.36, 1], // smooth deceleration for entrances
  inOut: [0.65, 0, 0.35, 1],
});

/** Spring used for press / hover feedback. */
export const SPRING_PRESS = Object.freeze({ type: 'spring', stiffness: 500, damping: 30 });

/** Fade + rise entrance. */
export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE.out } },
};

/** Plain fade. */
export const fade = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.base, ease: EASE.out } },
};

/**
 * Parent variant that staggers its children's entrance.
 * @param {number} [stagger=0.06] - Delay between children in seconds
 * @returns {Object} Framer Motion variants
 */
export const staggerContainer = (stagger = 0.06) => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger } },
});

/** Hover lift / tap press for cards and buttons. */
export const pressable = {
  whileHover: { y: -2 },
  whileTap: { scale: 0.97 },
  transition: SPRING_PRESS,
};
