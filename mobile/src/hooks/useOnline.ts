/**
 * useOnline — true while the SaathMein API is reachable (see lib/connectivity.ts).
 */
import { useSyncExternalStore } from 'react';

import { isOnline, subscribeOnline } from '@/lib/connectivity';

/**
 * @returns Whether the app is online
 */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, isOnline, () => true);
}
