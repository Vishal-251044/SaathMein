/**
 * Live group updates and group notifications (LIV-1, LIV-3) in one place, so services
 * only say what happened: the counter changed, someone joined, the status changed, or
 * members should be told something. Best effort: never throws.
 */
const Group = require('../../models/group.model');
const GroupMember = require('../../models/groupMember.model');
const Product = require('../../models/product.model');
const User = require('../../models/user.model');
const { createLogger } = require('../../utils/logger');
const { firstNameOnly } = require('../../helpers/genericFunctions');
const { emitToGroup } = require('../../sockets/emitter');
const { notifyUsers } = require('../notifications/notification.service');
const { MEMBER_STATUS, SOCKET_EVENTS } = require('../../constants/enums');

const log = createLogger('GroupLive');
const SEATED = [MEMBER_STATUS.ACTIVE, MEMBER_STATUS.ACCEPTED, MEMBER_STATUS.PURCHASED];

/** @param {string} groupId @returns {string} App route of the group page */
const groupUrl = (groupId) => `/group/${groupId}`;

/**
 * Send the current counter to everyone watching the group.
 * @param {string} groupId - Group id
 * @returns {Promise<void>}
 */
const publishGroupCount = async (groupId) => {
  try {
    const group = await Group.findById(groupId).select('memberCount targetSize status').lean();
    if (!group) return;
    emitToGroup(groupId, SOCKET_EVENTS.GROUP_COUNT, {
      memberCount: group.memberCount,
      targetSize: group.targetSize,
      status: group.status,
    });
  } catch (err) {
    log.warn({ err: err.message, groupId: String(groupId) }, 'Counter update failed');
  }
};

/**
 * Someone paid and joined: new-member animation + counter (first name and avatar only).
 * @param {string} groupId - Group id
 * @param {string} userId - New member
 * @returns {Promise<void>}
 */
const publishNewMember = async (groupId, userId) => {
  try {
    const user = await User.findById(userId).select('name avatar').lean();
    emitToGroup(groupId, SOCKET_EVENTS.GROUP_MEMBER, {
      member: {
        firstName: firstNameOnly(user?.name) || null,
        avatarUrl: user?.avatar?.url || null,
      },
    });
  } catch (err) {
    log.warn({ err: err.message }, 'New member update failed');
  }
  await publishGroupCount(groupId);
};

/**
 * Status changed (state machine effects).
 * @param {Object} group - Updated group
 */
const publishGroupStatus = (group) =>
  emitToGroup(group._id, SOCKET_EVENTS.GROUP_STATUS, {
    status: group.status,
    memberCount: group.memberCount,
    auction: group.auction?.endsAt
      ? { startsAt: group.auction.startsAt, endsAt: group.auction.endsAt }
      : null,
  });

/**
 * Product name for notification texts.
 * @param {Object} group - Lean group with productId
 * @returns {Promise<string>}
 */
const productNameOf = async (group) => {
  const product = await Product.findById(group.productId).select('brand model').lean();
  return product ? `${product.brand} ${product.model}` : 'SaathMein group';
};

/**
 * Notify the paid members (and the leader) of a group.
 * @param {string|Object} groupOrId - Group or id
 * @param {string} type - NOTIFICATION_TYPE
 * @param {Object} [extra] - Extra template values
 * @param {{ userIds?: string[] }} [options] - Fixed recipients (e.g. collected before refunds)
 * @returns {Promise<number>}
 */
const notifyGroupMembers = async (groupOrId, type, extra = {}, { userIds } = {}) => {
  try {
    const group =
      typeof groupOrId === 'object' && groupOrId.productId
        ? groupOrId
        : await Group.findById(groupOrId).lean();
    if (!group) return 0;
    const recipients = userIds ?? [
      ...(await GroupMember.find({ groupId: group._id, status: { $in: SEATED } }).distinct(
        'userId',
      )),
      group.leaderId,
    ];
    return notifyUsers(recipients, type, {
      productName: await productNameOf(group),
      memberCount: group.memberCount,
      targetSize: group.targetSize,
      groupId: group._id,
      url: groupUrl(group._id),
      ...extra,
    });
  } catch (err) {
    log.warn({ err: err.message, type }, 'Group notification failed');
    return 0;
  }
};

/**
 * Notify one person about a group.
 * @param {string} userId - Recipient
 * @param {string|Object} groupOrId - Group or id
 * @param {string} type - NOTIFICATION_TYPE
 * @param {Object} [extra] - Extra template values
 */
const notifyAboutGroup = (userId, groupOrId, type, extra = {}) =>
  notifyGroupMembers(groupOrId, type, extra, { userIds: [userId] });

/**
 * People to tell that a group ended — read BEFORE refunds change member statuses.
 * @param {string} groupId - Group id
 * @returns {Promise<string[]>}
 */
const groupRecipients = async (groupId) =>
  GroupMember.find({ groupId, status: { $in: SEATED } }).distinct('userId');

module.exports = {
  groupUrl,
  publishGroupCount,
  publishNewMember,
  publishGroupStatus,
  notifyGroupMembers,
  notifyAboutGroup,
  groupRecipients,
};
