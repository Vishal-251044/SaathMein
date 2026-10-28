/**
 * Auth flow navigator: language picker (first launch only) → phone number → OTP.
 */
import { Stack } from 'expo-router';

import { useSettingsStore } from '@/stores/settings.store';

/**
 * @returns Auth stack
 */
export default function AuthLayout() {
  const hasChosenLanguage = useSettingsStore((state) => state.hasChosenLanguage);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Protected guard={!hasChosenLanguage}>
        <Stack.Screen name="language" />
      </Stack.Protected>
      <Stack.Protected guard={hasChosenLanguage}>
        <Stack.Screen name="phone" />
        <Stack.Screen name="otp" />
      </Stack.Protected>
    </Stack>
  );
}
