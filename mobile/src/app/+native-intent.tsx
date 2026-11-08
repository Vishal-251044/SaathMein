/**
 * Every link that opens the app passes through here first (Expo Router native intent):
 * https://<domain>/g/<code> (Android App Links) and saathmein://g/<code>.
 * The invite code is remembered so it still opens if the user must log in first.
 */
import { inviteCodeFromPath, setPendingInvite } from '@/lib/pendingLink';

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
    return path;
  } catch {
    return '/';
  }
}
