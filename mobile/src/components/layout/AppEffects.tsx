/**
 * AppEffects — app-wide effects that need the query client (renders nothing):
 * push registration, the live socket and notification taps (useNotificationSetup), and an
 * invite link opened before login, once the user is fully in.
 */
import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';

import { useNotificationSetup } from '@/hooks/useNotifications';
import { takePendingInvite } from '@/lib/pendingLink';

interface AppEffectsProps {
  /** Signed in and onboarded. */
  isInApp: boolean;
}

/** @param props.isInApp - User can use the main app */
export function AppEffects({ isInApp }: AppEffectsProps) {
  const pathname = usePathname();
  useNotificationSetup(isInApp);

  useEffect(() => {
    if (!isInApp) return;
    const code = takePendingInvite();
    // Already on that invite (link opened while signed in): do not open it twice
    if (code && pathname.toUpperCase() !== `/G/${code}`) {
      router.push({ pathname: '/g/[code]', params: { code } });
    }
    // Only when the user becomes able to use the app, not on every navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInApp]);

  return null;
}
