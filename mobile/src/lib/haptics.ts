/**
 * Haptics — light taps for tab switches and main actions (selection feel). Loaded lazily
 * and fully optional: builds without the native module, web and errors are silent no-ops.
 */
type HapticsModule = typeof import('expo-haptics');

let haptics: HapticsModule | null | undefined;

/** Load expo-haptics once (null when the native module is not in this build). */
function load(): HapticsModule | null {
  if (haptics !== undefined) return haptics;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    haptics = require('expo-haptics') as HapticsModule;
  } catch {
    haptics = null;
  }
  return haptics;
}

/** Tiny tick for selection changes (tabs, chips). */
export function tapSelection(): void {
  load()
    ?.selectionAsync()
    .catch(() => {});
}

/** Light impact for primary actions (join, pay, send). */
export function tapLight(): void {
  const module = load();
  module?.impactAsync(module.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Success buzz (payment done, purchase confirmed, tier unlocked). */
export function tapSuccess(): void {
  const module = load();
  module?.notificationAsync(module.NotificationFeedbackType.Success).catch(() => {});
}
