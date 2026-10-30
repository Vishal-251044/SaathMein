/**
 * Group presenters — shapes for group cards, the group page and admin lists.
 * Privacy (PRD §14): members appear by first name and avatar only; no phone numbers.
 * The invite code is shown only to people who may share it (leader and members).
 */
const { toProductCard } = require('../catalog/productPresenter');
const { firstNameOnly } = require('../../helpers/genericFunctions');
const { earlyStartMinimum } = require('./stateMachine');

/** @param {*} id @returns {string|null} */
const str = (id) => (id ? String(id) : null);

/**
 * Group card (lists, product page, My Groups).
 * @param {Object} group - Lean group with `productId` populated
 * @param {{ viewerId?: string }} [context]
 * @returns {Object}
 */
const toGroupCard = (group, { viewerId } = {}) => {
  const product = group.productId && group.productId._id ? group.productId : null;
  const variant = product?.variants?.find((item) => item.key === group.variantKey);
  return {
    id: str(group._id),
    type: group.type,
    visibility: group.visibility,
    status: group.status,
    product: product ? toProductCard(product, str(group.cityId)) : { id: str(group.productId) },
    variantKey: group.variantKey || null,
    variantName: variant?.name || null,
    cityId: str(group.cityId),
    memberCount: group.memberCount,
    targetSize: group.targetSize,
    seatsLeft: Math.max(0, group.targetSize - group.memberCount),
    tokenAmountPaise: group.tokenAmountPaise,
    deadline: group.deadline,
    isLeader: Boolean(viewerId && str(group.leaderId) === String(viewerId)),
    createdAt: group.createdAt,
  };
};

/**
 * Full group page.
 * @param {Object} group - Lean group with `productId` populated
 * @param {Object} context
 * @param {string} [context.viewerId] - Logged-in user
 * @param {Object|null} [context.membership] - Viewer's GroupMember (lean)
 * @param {Object[]} [context.members] - Active members with `userId` populated (name, avatar)
 * @param {{ name: string }|null} [context.leader] - Leader user (name)
 * @param {{ earlyStartThresholdBps: number }} context.settings - Group settings
 * @returns {Object}
 */
const toGroupDetail = (
  group,
  { viewerId, membership = null, members = [], leader = null, settings },
) => {
  const card = toGroupCard(group, { viewerId });
  const canShare =
    card.isLeader || ['active', 'accepted', 'purchased', 'approved'].includes(membership?.status);
  const awaitingDecision = Boolean(group.leaderDecisionDueAt) && group.status === 'open';
  return {
    ...card,
    note: group.note || null,
    requiresApproval: Boolean(group.requiresApproval),
    inviteCode: canShare ? group.inviteCode : null,
    leader: leader ? { firstName: firstNameOnly(leader.name) || null } : null,
    members: members
      .filter((member) => member.userId)
      .map((member) => ({
        firstName: firstNameOnly(member.userId.name) || null,
        avatarUrl: member.userId.avatar?.url || null,
        isLeader: str(member.userId._id) === str(group.leaderId),
      })),
    myMembership: membership ? { status: membership.status, joinedAt: membership.joinedAt } : null,
    statusHistory: (group.statusHistory || []).map((entry) => ({
      from: entry.from || null,
      to: entry.to,
      reason: entry.reason || null,
      at: entry.at,
    })),
    auction: group.auction?.startsAt
      ? {
          startsAt: group.auction.startsAt,
          endsAt: group.auction.endsAt,
          dealerCount: group.auction.dealerCount || 0,
        }
      : null,
    // Deadline passed at ≥70%: what the leader may do now (GRP-5)
    leaderDecision:
      awaitingDecision && card.isLeader
        ? {
            dueAt: group.leaderDecisionDueAt,
            canExtend: !group.deadlineExtended,
            canStartEarly:
              group.memberCount >=
              earlyStartMinimum(group.targetSize, settings.earlyStartThresholdBps),
          }
        : null,
    awaitingLeaderDecision: awaitingDecision,
    canCancel: card.isLeader && group.status === 'open' && group.memberCount === 0,
  };
};

/**
 * Admin list row (read-only Groups module, PRD §10.11).
 * @param {Object} group - Lean group with productId, cityId, leaderId populated
 * @returns {Object}
 */
const toAdminGroup = (group) => ({
  id: str(group._id),
  type: group.type,
  visibility: group.visibility,
  status: group.status,
  productName: group.productId?.brand ? `${group.productId.brand} ${group.productId.model}` : null,
  productId: str(group.productId?._id || group.productId),
  cityName: group.cityId?.name || null,
  cityId: str(group.cityId?._id || group.cityId),
  categoryId: str(group.categoryId),
  leaderName: group.leaderId?.name || null,
  memberCount: group.memberCount,
  targetSize: group.targetSize,
  tokenAmountPaise: group.tokenAmountPaise,
  deadline: group.deadline,
  deadlineExtended: Boolean(group.deadlineExtended),
  leaderDecisionDueAt: group.leaderDecisionDueAt || null,
  inviteCode: group.inviteCode || null,
  createdAt: group.createdAt,
  statusHistory: group.statusHistory || [],
});

module.exports = { toGroupCard, toGroupDetail, toAdminGroup };
