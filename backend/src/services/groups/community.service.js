/**
 * Community groups (GRP-6): hidden from search, joined with an invite code or link; the
 * leader can require approval. Approval happens BEFORE payment: an approved person then
 * pays the token to take a seat (Day 7). Requests never hold a seat.
 */
const Group = require('../../models/group.model');
const GroupMember = require('../../models/groupMember.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { firstNameOnly } = require('../../helpers/genericFunctions');
const { getGroup } = require('./group.service');
const { GROUP_STATUS, MEMBER_STATUS } = require('../../constants/enums');

const log = createLogger('CommunityGroups');

/**
 * Open a group from its invite code (works for public share links too).
 * For groups needing approval, also files a join request.
 * @param {string} code - Invite code
 * @param {string} userId - Buyer
 * @returns {Promise<{ group: Object, nextStep: 'view'|'pay_token'|'wait_for_approval'|'declined' }>}
 * @throws {ApiError} 404 INVALID_CODE
 */
const joinByCode = async (code, userId) => {
  const group = await Group.findOne({ inviteCode: code.toUpperCase() }).lean();
  if (!group) {
    throw ApiError.notFound('This invite code is not valid. Check it and try again.', {
      code: 'INVALID_CODE',
    });
  }
  const groupId = String(group._id);
  const isLeader = String(group.leaderId) === String(userId);
  const existing = await GroupMember.findOne({ groupId, userId }).lean();
  const isOpen = group.status === GROUP_STATUS.OPEN;

  let nextStep = 'view';
  if (!isLeader && isOpen) {
    if (existing?.status === MEMBER_STATUS.REJECTED) nextStep = 'declined';
    else if (existing?.status === MEMBER_STATUS.PENDING_APPROVAL) nextStep = 'wait_for_approval';
    else if (
      existing &&
      existing.status !== MEMBER_STATUS.APPROVED &&
      existing.status !== MEMBER_STATUS.LEFT
    ) {
      nextStep = 'view'; // already a member
    } else if (group.requiresApproval && existing?.status !== MEMBER_STATUS.APPROVED) {
      await GroupMember.updateOne(
        { groupId, userId },
        {
          $set: { status: MEMBER_STATUS.PENDING_APPROVAL, joinedAt: new Date() },
          $unset: { leftAt: 1 },
        },
        { upsert: true },
      );
      nextStep = 'wait_for_approval';
      // TODO(Day 8): notify the leader of the request
      log.info({ groupId, userId }, 'Join request filed');
    } else {
      nextStep = 'pay_token'; // payment arrives on Day 7
    }
  }
  return { group: await getGroup(groupId, { userId, code }), nextStep };
};

/**
 * Pending join requests (leader only).
 * @param {string} groupId - Group id
 * @param {string} leaderId - Leader
 * @returns {Promise<Object[]>} `{ userId, firstName, avatarUrl, requestedAt }`
 */
const listJoinRequests = async (groupId, leaderId) => {
  const group = await Group.findById(groupId).select('leaderId').lean();
  if (!group) throw ApiError.notFound('Group not found');
  if (String(group.leaderId) !== String(leaderId))
    throw ApiError.forbidden('Only the group leader can see requests');

  const requests = await GroupMember.find({ groupId, status: MEMBER_STATUS.PENDING_APPROVAL })
    .sort({ joinedAt: 1 })
    .populate('userId', 'name avatar')
    .lean();
  return requests
    .filter((request) => request.userId)
    .map((request) => ({
      userId: String(request.userId._id),
      firstName: firstNameOnly(request.userId.name) || null,
      avatarUrl: request.userId.avatar?.url || null,
      requestedAt: request.joinedAt,
    }));
};

/**
 * Approve or decline a join request (leader only).
 * @param {string} groupId - Group id
 * @param {string} leaderId - Leader
 * @param {string} userId - Person who asked
 * @param {boolean} approve - true = approve
 * @returns {Promise<Object[]>} Remaining requests
 */
const decideJoinRequest = async (groupId, leaderId, userId, approve) => {
  const group = await Group.findById(groupId).select('leaderId status').lean();
  if (!group) throw ApiError.notFound('Group not found');
  if (String(group.leaderId) !== String(leaderId))
    throw ApiError.forbidden('Only the group leader can decide');
  if (group.status !== GROUP_STATUS.OPEN) {
    throw ApiError.conflict('This group is no longer open', { code: 'GROUP_NOT_OPEN' });
  }

  const result = await GroupMember.updateOne(
    { groupId, userId, status: MEMBER_STATUS.PENDING_APPROVAL },
    { $set: { status: approve ? MEMBER_STATUS.APPROVED : MEMBER_STATUS.REJECTED } },
  );
  if (!result.matchedCount) throw ApiError.notFound('Request not found');
  // TODO(Day 8): notify the person
  log.info({ groupId, userId, approve }, 'Join request decided');
  return listJoinRequests(groupId, leaderId);
};

module.exports = { joinByCode, listJoinRequests, decideJoinRequest };
