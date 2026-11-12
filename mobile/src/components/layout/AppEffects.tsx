/**
 * AppEffects — app-wide effects that need the query client (renders nothing):
 * push registration, the live socket and notification taps (useNotificationSetup), and an
 * invite link or referral link opened before login, once the user is fully in.
 */
import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';

import { useNotificationSetup } from '@/hooks/useNotifications';
import { takePendingInvite } from '@/lib/pendingLink';
import { getItem, removeItem, STORAGE_KEYS } from '@/lib/secureStorage';
import { applyReferral } from '@/services/discovery.service';

interface AppEffectsProps {
  /** Signed in and onboarded. */
  isInApp: boolean;
}

/** @param props.isInApp - User can use the main app */
export function AppEffects({ isInApp }: AppEffectsProps) {
  const pathname = usePathname();
  useNotificationSetup(isInApp);

  // A referral link opened before login: add the code once (errors such as "already
  // referred" are fine to drop — the wallet screen shows the current state)
  useEffect(() => {
    if (!isInApp) return;
    getItem(STORAGE_KEYS.PENDING_REFERRAL)
      .then(async (referral) => {
        if (!referral) return;
        await removeItem(STORAGE_KEYS.PENDING_REFERRAL);
        await applyReferral(referral).catch(() => {});
      })
      .catch(() => {});
  }, [isInApp]);

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
