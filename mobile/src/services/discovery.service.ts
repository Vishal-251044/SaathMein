/**
 * Discovery and wallet service — /feed/home (DIS-1), /groups with filters (DIS-4),
 * /users/me/wallet and /users/me/referral (REF-1 to REF-3).
 */
import type { GroupFilters, HomeFeed, Referral, WalletPage } from '@/types/feed';
import type { GroupCard, GroupPage } from '@/types/group';

import { api, type ApiEnvelope, unwrap } from './api';

/** Home sections for my city (or a chosen city). */
export function getHomeFeed(cityId?: string): Promise<HomeFeed> {
  return unwrap(api.get('/feed/home', { params: { cityId } }));
}

/**
 * One page of public groups with filters.
 * @param filters - Category, area, type, price, size, time left, sort
 * @param page - Page number (from 1)
 */
export async function browseGroups(filters: GroupFilters, page: number): Promise<GroupPage> {
  const response = await api.get<ApiEnvelope<{ groups: GroupCard[] }>>('/groups', {
    params: { ...filters, page, limit: 20 },
  });
  return { groups: response.data.data.groups, meta: response.data.meta as GroupPage['meta'] };
}

/** Balance and history. */
export async function getWallet(page = 1): Promise<WalletPage> {
  const response = await api.get<ApiEnvelope<Omit<WalletPage, 'meta'>>>('/users/me/wallet', {
    params: { page, limit: 30 },
  });
  return { ...response.data.data, meta: response.data.meta as WalletPage['meta'] };
}

/** My referral code, link and counts. */
export async function getReferral(): Promise<Referral> {
  return (await unwrap<{ referral: Referral }>(api.get('/users/me/referral'))).referral;
}

/** Add a friend's referral code (new accounts, once). */
export async function applyReferral(code: string): Promise<Referral> {
  return (await unwrap<{ referral: Referral }>(api.post('/users/me/referral', { code }))).referral;
}
