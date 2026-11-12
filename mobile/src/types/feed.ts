/**
 * Home feed (GET /feed/home, DIS-1) and wallet / referral (REF-1 to REF-3) types.
 */
import type { CategoryGroup } from './catalog';
import type { GroupCard } from './group';

export type HomeSectionKey =
  'featured' | 'near_you' | 'ending_soon' | 'almost_full' | 'seller_deals' | 'trending';

export interface HomeBanner {
  id: string;
  title: string;
  titleTranslations: { hi?: string; mr?: string };
  subtitle: string | null;
  subtitleTranslations: { hi?: string; mr?: string };
  imageUrl: string | null;
  /** In-app path, e.g. "/category/<id>" or "/browse?type=seller_led". */
  linkPath: string | null;
}

export interface HomeFeed {
  cityId: string | null;
  banners: HomeBanner[];
  sections: { key: HomeSectionKey; groups: GroupCard[] }[];
  categories: CategoryGroup[];
}

/** Filters for browsing groups (DIS-4). */
export interface GroupFilters {
  categoryId?: string;
  area?: string;
  type?: 'buyer_led' | 'seller_led';
  minPricePaise?: number;
  maxPricePaise?: number;
  minSize?: number;
  maxSize?: number;
  endsWithinHours?: number;
  sort?: 'ending_soon' | 'filling' | 'newest';
}

export type WalletTxnType = 'referral_referrer' | 'referral_friend' | 'leader_bonus' | 'adjustment';

export interface WalletTransaction {
  id: string;
  type: WalletTxnType;
  amountPaise: number;
  balanceAfterPaise: number;
  groupId: string | null;
  createdAt: string;
}

export interface WalletPage {
  balancePaise: number;
  transactions: WalletTransaction[];
  meta: { page: number; totalPages: number; hasNextPage: boolean };
}

export interface Referral {
  enabled: boolean;
  code: string;
  link: string;
  referrerCreditPaise: number;
  friendCreditPaise: number;
  leaderBonusPaise: number;
  invitedCount: number;
  rewardedCount: number;
  referredBy: boolean;
  canAddCode: boolean;
}
