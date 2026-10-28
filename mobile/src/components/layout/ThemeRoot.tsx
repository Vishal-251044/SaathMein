/**
 * ThemeRoot — applies the Sunrise theme at the app root:
 * - NativeWind CSS variables for the current scheme (so `bg-surface`, `text-ink` switch
 *   with dark mode),
 * - the React Navigation theme (screen backgrounds, no white flash in dark mode),
 * - the status bar style.
 */
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode } from 'react';
import { View } from 'react-native';

import { useThemeColors } from '@/hooks/useThemeColors';
import { brand, themeVars } from '@/theme/tokens';

interface ThemeRootProps {
  children: ReactNode;
}

/**
 * @param props.children - The app navigator
 */
export function ThemeRoot({ children }: ThemeRootProps) {
  const { scheme, colors } = useThemeColors();
  const baseTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: brand.primary,
      background: colors.bg,
      card: colors.surface,
      text: colors.ink,
      border: colors.line,
      notification: brand.coral,
    },
  };

  return (
    <View style={themeVars[scheme]} className="flex-1 bg-bg">
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {children}
      </ThemeProvider>
    </View>
  );
}
