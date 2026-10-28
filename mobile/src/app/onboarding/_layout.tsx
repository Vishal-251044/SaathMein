/**
 * Onboarding navigator (Day 3): city & area → interests. Shown once after first login.
 */
import { Stack } from 'expo-router';

import { useAuthStore } from '@/stores/auth.store';

/**
 * @returns Onboarding stack
 */
export default function OnboardingLayout() {
  const hasCity = useAuthStore((state) => Boolean(state.user?.cityId));

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Protected guard={!hasCity}>
        <Stack.Screen name="city" />
      </Stack.Protected>
      <Stack.Protected guard={hasCity}>
        <Stack.Screen name="interests" />
      </Stack.Protected>
    </Stack>
  );
}
