/**
 * An invite link opened while signed out (or still onboarding) is kept here, and opened
 * right after the user finishes logging in (LIV-4).
 */

let pendingInviteCode: string | null = null;

/** Invite code from a /g/<code> path, if any. */
export function inviteCodeFromPath(path: string): string | null {
  const match = /(?:^|\/)g\/([A-Za-z0-9]{6,12})(?:[/?#]|$)/.exec(path);
  return match ? match[1].toUpperCase() : null;
}

/** Referral code from a /r/<code> path, if any (REF-1). */
export function referralCodeFromPath(path: string): string | null {
  const match = /(?:^|\/)r\/([A-Za-z0-9]{6,12})(?:[/?#]|$)/.exec(path);
  return match ? match[1].toUpperCase() : null;
}

/** Remember an invite to open later. */
export function setPendingInvite(code: string): void {
  pendingInviteCode = code;
}

/** @returns The remembered invite (and forgets it) */
export function takePendingInvite(): string | null {
  const code = pendingInviteCode;
  pendingInviteCode = null;
  return code;
}
