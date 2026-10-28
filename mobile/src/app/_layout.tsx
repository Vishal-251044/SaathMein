/**
 * Root layout: loads fonts, saved settings and the saved session behind the splash screen,
 * wraps the app in its providers, and guards routes:
 * - signed out              → (auth): language (first launch) → phone → OTP
 * - signed in, not onboarded → onboarding: city → interests (Day 3)
 * - signed in, onboarded     → (tabs) and profile edit screens
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
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { appFonts } from '@/theme/fonts';

// Keep the splash visible until fonts, settings and session are ready (no flashes)
SplashScreen.preventAutoHideAsync();

/**
 * @returns The app navigator once everything needed for the first screen is loaded
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const isSettingsHydrated = useSettingsStore((state) => state.isHydrated);
  const authStatus = useAuthStore((state) => state.status);
  // User is null when the profile could not load yet (offline start): show the app, not onboarding
  const needsOnboarding = useAuthStore((state) =>
    Boolean(state.user && !state.user.onboardingCompletedAt),
  );

  useEffect(() => {
    useSettingsStore
      .getState()
      .hydrate()
      .catch(() => {});
    useAuthStore
      .getState()
      .bootstrap()
      .catch(() => {});
  }, []);

  const isReady =
    (fontsLoaded || Boolean(fontError)) && isSettingsHydrated && authStatus !== 'loading';

  useEffect(() => {
    if (isReady) SplashScreen.hideAsync();
  }, [isReady]);

  if (!isReady) return null;

  const isSignedIn = authStatus === 'signedIn';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeRoot>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Protected guard={isSignedIn && !needsOnboarding}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="edit-profile" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="edit-city" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="edit-interests" options={{ animation: 'slide_from_right' }} />
              </Stack.Protected>
              <Stack.Protected guard={isSignedIn && needsOnboarding}>
                <Stack.Screen name="onboarding" />
              </Stack.Protected>
              <Stack.Protected guard={!isSignedIn}>
                <Stack.Screen name="(auth)" />
              </Stack.Protected>
            </Stack>
          </ThemeRoot>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
