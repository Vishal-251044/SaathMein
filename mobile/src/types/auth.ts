/**
 * Auth-related types shared by services and stores (mirror the backend responses).
 */

/** Buying timeline from interest onboarding (ACC-3). */
export type BuyingTimeline = 'this_month' | '1_3_months' | 'exploring';

/** What the user plans to buy. Budgets are integer paise. */
export interface UserInterests {
  categories: string[];
  products: string[];
  brands: string[];
  budgetMinPaise: number | null;
  budgetMaxPaise: number | null;
  timeline: BuyingTimeline | null;
}

/** The logged-in user's own profile (backend `toAppUser`). Money is integer paise. */
export interface AppUser {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  avatar: { url: string } | null;
  cityId: string | null;
  area: string | null;
  pincode: string | null;
  language: 'en' | 'hi' | 'mr';
  interests: UserInterests;
  onboardingCompletedAt: string | null;
  walletBalancePaise: number;
  createdAt: string;
}

/** Token pair from login and refresh. */
export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  sessionId: string;
}

/** POST /auth/otp/verify response data. */
export interface LoginResult {
  user: AppUser;
  isNewUser: boolean;
  tokens: AuthTokens;
}
