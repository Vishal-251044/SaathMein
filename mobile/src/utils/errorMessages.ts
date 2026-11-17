/**
 * Map API and phone-auth error codes to translation keys, so every error a user sees
 * is translated (never a raw English backend message).
 */
import { PhoneAuthError } from '@/lib/phoneAuth';
import { ApiClientError } from '@/services/api';
import { GoogleAuthError } from '@/lib/googleAuth';

const ERROR_KEYS: Record<string, string> = {
  // Backend (ApiClientError.code)
  OTP_LIMIT: 'errors.otpLimit',
  TOO_MANY_REQUESTS: 'errors.otpLimit',
  INVALID_PHONE: 'errors.invalidPhone',
  ACCOUNT_SUSPENDED: 'errors.accountSuspended',
  ACCOUNT_DELETED: 'errors.accountSuspended',
  // Account deletion is refused while money is in play (Day 14)
  ACCOUNT_HAS_ACTIVE_TOKEN: 'errors.accountHasActiveToken',
  ACCOUNT_OWNS_BUSINESS: 'errors.accountOwnsBusiness',
  FIREBASE_NOT_CONFIGURED: 'errors.loginUnavailable',
  DATABASE_UNAVAILABLE: 'errors.serviceUnavailable',
  INVALID_FIREBASE_TOKEN: 'errors.codeExpired',
  NETWORK_ERROR: 'errors.network',
  VALIDATION_ERROR: 'errors.validation',
  CITY_UNAVAILABLE: 'errors.cityUnavailable',
  AREA_UNAVAILABLE: 'errors.areaUnavailable',
  CITY_REQUIRED: 'errors.cityUnavailable',
  INVALID_CATEGORY: 'errors.invalidCategory',
  UPLOADS_NOT_CONFIGURED: 'errors.uploadsUnavailable',
  INVALID_UPLOAD: 'errors.uploadFailed',
  UPLOAD_FAILED: 'errors.uploadFailed',
  // Groups (Day 6)
  INVALID_SIZE: 'errors.invalidGroupSize',
  INVALID_DEADLINE: 'errors.invalidDeadline',
  INVALID_VARIANT: 'errors.validation',
  CATEGORY_INACTIVE: 'errors.categoryInactive',
  TOO_MANY_GROUPS: 'errors.tooManyGroups',
  GROUP_CHANGED: 'errors.groupChanged',
  ALREADY_EXTENDED: 'errors.alreadyExtended',
  EXTENSION_NOT_POSSIBLE: 'errors.extensionNotPossible',
  NO_DECISION_PENDING: 'errors.groupChanged',
  GROUP_HAS_MEMBERS: 'errors.groupHasMembers',
  INVITE_CODE_INVALID: 'errors.inviteCodeInvalid',
  GROUP_NOT_OPEN: 'errors.groupClosed',
  // Payments (Day 7)
  ALREADY_MEMBER: 'errors.alreadyMember',
  GROUP_FULL: 'errors.groupFull',
  GROUP_CLOSED: 'errors.groupClosed',
  SEATS_RESERVED: 'errors.seatsReserved',
  SEATS_AVAILABLE: 'errors.seatsAvailable',
  APPROVAL_REQUIRED: 'errors.approvalRequired',
  PAYMENTS_UNAVAILABLE: 'errors.paymentsUnavailable',
  RAZORPAY_ERROR: 'errors.paymentsUnavailable',
  INVALID_SIGNATURE: 'errors.paymentNotVerified',
  CANNOT_LEAVE: 'errors.cannotLeave',
  // Chat (Day 8)
  CHAT_MEMBERS_ONLY: 'errors.chatMembersOnly',
  CHAT_RATE_LIMIT: 'errors.chatTooFast',
  POLL_LEADER_ONLY: 'errors.pollLeaderOnly',
  EMPTY_MESSAGE: 'errors.validation',
  TOO_MANY_PINNED: 'errors.tooManyPinned',
  OWN_MESSAGE: 'errors.validation',
  POLL_CLOSED: 'errors.pollClosed',
  // Auctions (Day 9)
  AUCTION_NOT_LIVE: 'errors.groupChanged',
  // Purchases (Day 10)
  PURCHASE_CLOSED: 'errors.purchaseClosed',
  DEAL_CODE_EXPIRED: 'errors.dealCodeExpired',
  PURCHASE_NOT_COMPLETED: 'errors.purchaseClosed',
  ALREADY_REVIEWED: 'errors.alreadyReviewed',
  PHOTO_PERMISSION_DENIED: 'errors.photoPermission',
  // Discovery, referrals, flags (Day 11)
  REFERRAL_ALREADY_SET: 'errors.referralAlreadySet',
  REFERRAL_TOO_LATE: 'errors.referralTooLate',
  REFERRAL_CODE_INVALID: 'errors.referralInvalid',
  OWN_REFERRAL_CODE: 'errors.referralOwn',
  REFERRAL_LOOP: 'errors.referralLoop',
  REFERRALS_OFF: 'errors.featureOff',
  COMMUNITY_GROUPS_OFF: 'errors.featureOff',
  MAINTENANCE: 'errors.maintenance',
  // Trust (Day 12)
  ALREADY_REPORTED: 'errors.alreadyReported',
  OWN_TARGET: 'errors.ownTarget',
  DISPUTE_ALREADY_OPEN: 'errors.disputeOpen',
  NOT_DISPUTABLE: 'errors.notDisputable',
  TOO_MANY_FILES: 'errors.tooManyFiles',
  // Firebase phone auth (PhoneAuthError.code)
  INVALID_CODE: 'errors.invalidCode',
  CODE_EXPIRED: 'errors.codeExpired',
  TOO_MANY_ATTEMPTS: 'errors.tooManyAttempts',
  PHONE_AUTH_UNAVAILABLE: 'errors.phoneAuthUnavailable',
  // Google sign-in (F4)
  GOOGLE_UNAVAILABLE: 'errors.googleUnavailable',
  GOOGLE_PLAY_SERVICES: 'errors.googlePlayServices',
  GOOGLE_FAILED: 'errors.googleFailed',
  GOOGLE_LOGIN_REQUIRED: 'errors.googleFailed',
  GOOGLE_EMAIL_UNVERIFIED: 'errors.googleEmailUnverified',
  EMAIL_TAKEN: 'errors.googleEmailTaken',
  STAFF_ACCOUNT: 'errors.googleStaffAccount',
  PHONE_IN_USE: 'errors.phoneInUse',
  PHONE_REQUIRED: 'errors.phoneRequired',
};

/**
 * Translation key for any error thrown during login.
 * @param error - Caught error
 * @returns i18n key such as "errors.invalidCode"
 */
export function getErrorMessageKey(error: unknown): string {
  if (
    error instanceof ApiClientError ||
    error instanceof PhoneAuthError ||
    error instanceof GoogleAuthError
  ) {
    return ERROR_KEYS[error.code] ?? 'errors.generic';
  }
  // Local errors thrown with a code as the message (photo permission, upload failed)
  if (error instanceof Error && ERROR_KEYS[error.message]) return ERROR_KEYS[error.message];
  return 'errors.generic';
}
