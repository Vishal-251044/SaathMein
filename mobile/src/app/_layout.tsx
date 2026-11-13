/**
 * Root layout: loads fonts, saved settings and the saved session behind the splash screen,
 * wraps the app in its providers, and guards routes:
 * - signed out              → (auth): language (first launch) → phone → OTP
 * - signed in, not onboarded → onboarding: city → interests (Day 3)
 * - signed in, onboarded     → (tabs) and profile edit screens
 */
import '../global.css';
import '@/i18n';
import '@/lib/nativewindInterop';

import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { type Href, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppEffects } from '@/components/layout/AppEffects';
import { OfflineBanner } from '@/components/layout/OfflineBanner';
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
  const hasCity = useAuthStore((state) => Boolean(state.user?.cityId));
  const hasChosenLanguage = useSettingsStore((state) => state.hasChosenLanguage);

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

  // Where a blocked route sends the user. Phones open the first allowed screen anyway,
  // but on web every URL (e.g. "/") must resolve to a real screen.
  const startRoute: Href = !isSignedIn
    ? hasChosenLanguage
      ? '/phone'
      : '/language'
    : needsOnboarding
      ? hasCity
        ? '/onboarding/interests'
        : '/onboarding/city'
      : '/';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeRoot>
            <AppEffects isInApp={isSignedIn && !needsOnboarding} />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Protected guard={isSignedIn && !needsOnboarding} redirectTo={startRoute}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="edit-profile" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="edit-city" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="edit-interests" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="category/[id]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="product/[id]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="request-product" options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="group/[id]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="group/create" options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="g/[code]" options={{ animation: 'fade' }} />
                <Stack.Screen name="pay/[groupId]" options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="group/chat/[id]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
              </Stack.Protected>
              <Stack.Protected guard={isSignedIn && needsOnboarding} redirectTo={startRoute}>
                <Stack.Screen name="onboarding" />
              </Stack.Protected>
              <Stack.Protected guard={!isSignedIn} redirectTo={startRoute}>
                <Stack.Screen name="(auth)" />
              </Stack.Protected>
            </Stack>
            {isSignedIn ? <OfflineBanner /> : null}
          </ThemeRoot>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
