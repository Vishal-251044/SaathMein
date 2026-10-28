/**
 * Root layout: loads fonts behind the splash screen and wraps the app in its providers
 * (gesture handler, safe area, TanStack Query, i18n, Sunrise theme).
 */
import '../global.css';
import '@/i18n';

import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeRoot } from '@/components/layout/ThemeRoot';
import { queryClient } from '@/lib/queryClient';
import { appFonts } from '@/theme/fonts';

// Keep the splash visible until fonts are ready, so text never flashes in a fallback font
SplashScreen.preventAutoHideAsync();

/**
 * @returns The app navigator once fonts are loaded
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const isReady = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (isReady) SplashScreen.hideAsync();
  }, [isReady]);

  if (!isReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeRoot>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
          </ThemeRoot>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
