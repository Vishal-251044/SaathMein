/**
 * Every link that opens the app passes through here first (Expo Router native intent):
 * https://<domain>/g/<code> (Android App Links) and saathmein://g/<code>, and referral links
 * /r/<code>.
 * The invite code is remembered so it still opens if the user must log in first.
 */
import { inviteCodeFromPath, referralCodeFromPath, setPendingInvite } from '@/lib/pendingLink';
import { setItem, STORAGE_KEYS } from '@/lib/secureStorage';

/**
 * @param options.path - Incoming path or URL
 * @returns The path Expo Router should open
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const code = inviteCodeFromPath(path);
    if (code) {
      setPendingInvite(code);
      return `/g/${code}`;
    }
    // Referral link: kept on the phone, added to the account once the user is in (REF-1)
    const referral = referralCodeFromPath(path);
    if (referral) {
      setItem(STORAGE_KEYS.PENDING_REFERRAL, referral).catch(() => {});
      return '/wallet';
    }
    return path;
  } catch {
    return '/';
  }
}
