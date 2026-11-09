/**
 * Group service — /groups (PRD §10.3, §12.3). Joining with a token arrives on Day 7.
 */
import type {
  CreateGroupInput,
  GroupCard,
  GroupDetail,
  GroupPage,
  JoinNextStep,
  JoinRequest,
} from '@/types/group';

import { api, type ApiEnvelope, unwrap } from './api';

/**
 * Browse public groups.
 * @param params - Filters: productId, categoryId, sort, page
 * @returns One page of group cards
 */
export async function listGroups(params: {
  productId?: string;
  categoryId?: string;
  sort?: 'ending_soon' | 'filling' | 'newest';
  page?: number;
  limit?: number;
}): Promise<GroupPage> {
  const response = await api.get<ApiEnvelope<{ groups: GroupCard[] }>>('/groups', { params });
  return { groups: response.data.data.groups, meta: response.data.meta as GroupPage['meta'] };
}

/**
 * Open groups for the same product in my city ("join this one instead?", GRP-2).
 * @param productId - Product
 * @param variantKey - Chosen variant (groups for "any variant" also match)
 */
export async function getSimilarGroups(
  productId: string,
  variantKey: string | null,
): Promise<GroupCard[]> {
  const data = await unwrap<{ groups: GroupCard[] }>(
    api.get('/groups/similar', { params: { productId, variantKey: variantKey || undefined } }),
  );
  return data.groups;
}

/** @returns My groups — joined or leading */
export async function getMyGroups(role: 'joined' | 'leading', page = 1): Promise<GroupPage> {
  const response = await api.get<ApiEnvelope<{ groups: GroupCard[] }>>('/groups/mine', {
    params: { role, page, limit: 20 },
  });
  return { groups: response.data.data.groups, meta: response.data.meta as GroupPage['meta'] };
}

/** @param groupId - Group @param code - Invite code for community groups */
export async function getGroup(groupId: string, code?: string): Promise<GroupDetail> {
  const data = await unwrap<{ group: GroupDetail }>(
    api.get(`/groups/${groupId}`, { params: { code: code || undefined } }),
  );
  return data.group;
}

/** @returns The new group page */
export async function createGroup(input: CreateGroupInput): Promise<GroupDetail> {
  const data = await unwrap<{ group: GroupDetail }>(api.post('/groups', input));
  return data.group;
}

/** Open a group from an invite code (files a join request when approval is needed). */
export function joinByCode(code: string): Promise<{ group: GroupDetail; nextStep: JoinNextStep }> {
  return unwrap(api.post('/groups/join-by-code', { code }));
}

/** Leader: extend the deadline once. */
export async function extendGroup(groupId: string): Promise<GroupDetail> {
  return (await unwrap<{ group: GroupDetail }>(api.post(`/groups/${groupId}/extend`))).group;
}

/** Leader: start the auction early (≥70% after the deadline). */
export async function startAuctionEarly(groupId: string): Promise<GroupDetail> {
  return (await unwrap<{ group: GroupDetail }>(api.post(`/groups/${groupId}/start-auction`))).group;
}
/**
 * Leader: accept the only dealer's price, or cancel with full refunds (decided 8 Nov 2026).
 * @param input.accept - true = buy at that price
 */
export async function decideSingleBid({
  groupId,
  accept,
}: {
  groupId: string;
  accept: boolean;
}): Promise<GroupDetail> {
  return (
    await unwrap<{ group: GroupDetail }>(
      api.post(`/groups/${groupId}/auction/decision`, { accept }),
    )
  ).group;
}

/** Leader: cancel a group nobody has paid for. */
export async function cancelGroup(groupId: string): Promise<GroupDetail> {
  return (await unwrap<{ group: GroupDetail }>(api.post(`/groups/${groupId}/cancel`))).group;
}

/** Leader: pending join requests (community groups with approval). */
export async function getJoinRequests(groupId: string): Promise<JoinRequest[]> {
  return (await unwrap<{ requests: JoinRequest[] }>(api.get(`/groups/${groupId}/requests`)))
    .requests;
}

/** Leader: approve or decline a request. @returns Remaining requests */
export async function decideJoinRequest(
  groupId: string,
  userId: string,
  approve: boolean,
): Promise<JoinRequest[]> {
  return (
    await unwrap<{ requests: JoinRequest[] }>(
      api.post(`/groups/${groupId}/requests/${userId}`, { approve }),
    )
  ).requests;
}
