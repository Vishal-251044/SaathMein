/**
 * useThemeColors — current light/dark palette as hex values, for props that cannot
 * use Tailwind classes (icon colours, tab bar options, gradients).
 */
import { useColorScheme } from 'react-native';

import { colors, type ColorScheme, type ThemeColors } from '@/theme/tokens';

/**
 * @returns The colour scheme in use and its palette
 */
export function useThemeColors(): { scheme: ColorScheme; colors: ThemeColors } {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: colors[scheme] };
}
