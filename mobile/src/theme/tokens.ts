/**
 * Design tokens for places Tailwind classes cannot reach: icon colours, gradients,
 * navigation options, StatusBar and shadows. Colours come from palette.js.
 */
import { vars } from 'nativewind';
import { Platform } from 'react-native';

import palette from './palette';

export type ColorScheme = 'light' | 'dark';
export type ThemeColors = typeof palette.light;

export const brand = palette.brand;
export const gradients = palette.gradients as {
  sunrise: [string, string, string];
  saathi: [string, string];
};

/** Hex colours per scheme, for component props (icons, tab bar, gradients). */
export const colors: Record<ColorScheme, ThemeColors> = {
  light: palette.light,
  dark: palette.dark,
};

/**
 * NativeWind CSS variables per scheme. ThemeRoot applies these at the app root so
 * classes like `bg-surface` and `text-muted` switch automatically with dark mode.
 */
export const themeVars: Record<ColorScheme, ReturnType<typeof vars>> = {
  light: vars(buildVars(palette.light)),
  dark: vars(buildVars(palette.dark)),
};

/**
 * Turn a palette into `{ '--color-bg': '255 255 255', ... }`.
 * @param colorSet - Light or dark palette
 * @returns CSS variable map for NativeWind `vars()`
 */
function buildVars(colorSet: ThemeColors): Record<string, string> {
  return Object.fromEntries(
    Object.entries(colorSet).map(([key, hex]) => [
      palette.cssVarName(key),
      palette.hexToChannels(hex),
    ]),
  );
}

/** Spacing scale in dp (matches Tailwind: 1 unit = 4 dp). */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Corner radius in dp. */
export const radius = { card: 20, button: 14, pill: 999 } as const;

/** Minimum touch target in dp (PRD §14: 48 dp). */
export const TOUCH_TARGET = 48;

/** Soft card shadow (Android uses elevation, iOS/web use shadow props). */
export const cardShadow = Platform.select({
  android: { elevation: 2 },
  default: {
    shadowColor: '#12131F',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
});
