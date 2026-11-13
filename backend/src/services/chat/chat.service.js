/**
 * Group chat (LIV-5): text, images, polls (leader), pinned messages, reports.
 * Who can chat: paid members and the leader; the winning dealer's team joins once the
 * group is won (until it completes) and posts as the business (Day 13 carry-over). Abusive words are masked; 10 messages a minute per person; a message reported
 * by 3 members is hidden until Support reviews it (Day 12). Every change is sent live to
 * the group room.
 */
const Group = require('../../models/group.model');
const GroupMember = require('../../models/groupMember.model');
const Message = require('../../models/message.model');
const Seller = require('../../models/seller.model');
const User = require('../../models/user.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { firstNameOnly } = require('../../helpers/genericFunctions');
const { assertWithinLimit } = require('../rateLimit.service');
const uploadService = require('../upload.service');
const { emitToGroup } = require('../../sockets/emitter');
const { filterProfanity } = require('./profanity');
const { GROUP_STATUS, MEMBER_STATUS, SOCKET_EVENTS } = require('../../constants/enums');

const log = createLogger('ChatService');
const SEATED = [MEMBER_STATUS.ACTIVE, MEMBER_STATUS.ACCEPTED, MEMBER_STATUS.PURCHASED];
const PAGE_SIZE = 30;
const HIDE_AFTER_REPORTS = 3;
const MAX_PINNED = 3;
// The dealer may chat with the group from the win until the group completes
const DEALER_CHAT_STATUSES = [GROUP_STATUS.WON, GROUP_STATUS.PURCHASING, GROUP_STATUS.COMPLETED];

/**
 * Load the group and check this user may use its chat.
 * @param {string} groupId - Group
 * @param {string} userId - User
 * @returns {Promise<{ group: Object, isLeader: boolean }>}
 * @throws {ApiError} 404 / 403 CHAT_MEMBERS_ONLY
 */
const loadChatAccess = async (groupId, userId) => {
  const group = await Group.findById(groupId).select('leaderId status productId').lean();
  if (!group) throw ApiError.notFound('Group not found');
  const isLeader = String(group.leaderId) === String(userId);
  if (!isLeader) {
    const seated = await GroupMember.exists({ groupId, userId, status: { $in: SEATED } });
    if (!seated) {
      throw new ApiError(403, 'Only group members can use the chat', { code: 'CHAT_MEMBERS_ONLY' });
    }
  }
  return { group, isLeader };
};

/**
 * App shape of a message (first names only, my vote, report count hidden).
 * @param {Object} message - Lean message
 * @param {{ viewerId: string, senders: Map<string, Object>, leaderId: string }} context
 * @returns {Object}
 */
const toChatMessage = (message, { viewerId, senders, leaderId }) => {
  const sender = message.senderId ? senders.get(String(message.senderId)) : null;
  const isDealer = message.senderType === 'seller';
  return {
    id: String(message._id),
    senderType: message.senderType,
    sender: isDealer
      ? { firstName: message.senderLabel || null, avatarUrl: null, isLeader: false, isDealer: true }
      : sender
        ? {
            firstName: firstNameOnly(sender.name) || null,
            avatarUrl: sender.avatar?.url || null,
            isLeader: String(sender._id) === String(leaderId),
            isDealer: false,
          }
        : null,
    isMine: Boolean(message.senderId && String(message.senderId) === String(viewerId)),
    text: message.hidden ? null : message.text || null,
    images: message.hidden ? [] : message.images || [],
    poll:
      message.poll && !message.hidden
        ? {
            question: message.poll.question,
            closed: Boolean(message.poll.closed),
            options: message.poll.options.map((option) => ({
              text: option.text,
              votes: option.votes.length,
            })),
            myVote: message.poll.options.findIndex((option) =>
              option.votes.some((id) => String(id) === String(viewerId)),
            ),
          }
        : null,
    pinned: Boolean(message.pinned),
    hidden: Boolean(message.hidden),
    reportedByMe: (message.reports || []).some(
      (report) => String(report.userId) === String(viewerId),
    ),
    createdAt: message.createdAt,
  };
};

/** Load senders for a list of messages. */
const loadSenders = async (messages) => {
  const ids = [
    ...new Set(
      messages
        .map((message) => message.senderId)
        .filter(Boolean)
        .map(String),
    ),
  ];
  const users = await User.find({ _id: { $in: ids } })
    .select('name avatar')
    .lean();
  return new Map(users.map((user) => [String(user._id), user]));
};

/**
 * Present one message for live delivery. Votes and "mine" are per viewer, so the live
 * payload is neutral (myVote -1, isMine false); the app keeps its own state.
 */
const presentForRoom = async (message, group) => {
  const senders = await loadSenders([message]);
  return toChatMessage(message, { viewerId: null, senders, leaderId: group.leaderId });
};

/**
 * Messages, newest first, older pages with `before` (message id).
 * @param {string} groupId - Group
 * @param {string} userId - Reader
 * @param {{ before?: string, limit?: string }} query
 * @returns {Promise<{ messages: Object[], pinned: Object[], hasMore: boolean }>}
 */
const listMessages = async (groupId, userId, { before, limit } = {}) => {
  const { group } = await loadChatAccess(groupId, userId);
  const pageSize = Math.min(Number.parseInt(limit, 10) || PAGE_SIZE, 50);
  const filter = { groupId };
  if (before) {
    const anchor = await Message.findOne({ _id: before, groupId }).select('createdAt').lean();
    if (anchor) filter.createdAt = { $lt: anchor.createdAt };
  }
  const [page, pinned] = await Promise.all([
    Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(pageSize + 1)
      .lean(),
    before
      ? []
      : Message.find({ groupId, pinned: true, hidden: false })
          .sort({ updatedAt: -1 })
          .limit(MAX_PINNED)
          .lean(),
  ]);
  const messages = page.slice(0, pageSize);
  const senders = await loadSenders([...messages, ...pinned]);
  const context = { viewerId: userId, senders, leaderId: group.leaderId };
  return {
    messages: messages.map((message) => toChatMessage(message, context)),
    pinned: pinned.map((message) => toChatMessage(message, context)),
    hasMore: page.length > pageSize,
  };
};

/**
 * Signed params to upload one chat image.
 * @param {string} groupId - Group
 * @param {string} userId - Member
 */
const getChatImageUploadParams = async (groupId, userId) => {
  await loadChatAccess(groupId, userId);
  return uploadService.createChatImageUploadParams(groupId);
};

/**
 * Send a message: text and/or one image, or a poll (leader only).
 * @param {string} groupId - Group
 * @param {string} userId - Sender
 * @param {{ text?: string, image?: { publicId: string, version: number, signature: string },
 *   poll?: { question: string, options: string[] } }} input
 * @returns {Promise<Object>} The message as the sender sees it
 * @throws {ApiError} 403, 422 EMPTY_MESSAGE / POLL_LEADER_ONLY, 429
 */
const sendMessage = async (groupId, userId, input) => {
  const { group, isLeader } = await loadChatAccess(groupId, userId);
  await assertWithinLimit({
    key: `chat:${groupId}:${userId}`,
    limit: 10,
    windowMs: 60_000,
    message: 'You are sending messages too fast. Please wait a moment.',
    code: 'CHAT_RATE_LIMIT',
  });

  const text = input.text ? filterProfanity(input.text.trim()).text : undefined;
  const images = input.image ? [uploadService.verifyChatImageUpload(groupId, input.image)] : [];
  let poll;
  if (input.poll) {
    if (!isLeader)
      throw new ApiError(403, 'Only the group leader can start a poll', {
        code: 'POLL_LEADER_ONLY',
      });
    poll = {
      question: filterProfanity(input.poll.question.trim()).text,
      options: input.poll.options.map((option) => ({
        text: filterProfanity(option.trim()).text,
        votes: [],
      })),
    };
  }
  if (!text && !images.length && !poll) {
    throw new ApiError(422, 'Write a message, add a photo or start a poll', {
      code: 'EMPTY_MESSAGE',
    });
  }

  const message = await Message.create({
    groupId,
    senderId: userId,
    senderType: 'buyer',
    text,
    images,
    poll,
  });
  const lean = message.toObject();
  emitToGroup(groupId, SOCKET_EVENTS.CHAT_MESSAGE, { message: await presentForRoom(lean, group) });
  const senders = await loadSenders([lean]);
  return toChatMessage(lean, { viewerId: userId, senders, leaderId: group.leaderId });
};

/**
 * Load a message of this group for an action.
 * @returns {Promise<Object>} Message document
 */
const findMessage = async (groupId, messageId) => {
  const message = await Message.findOne({ _id: messageId, groupId });
  if (!message) throw ApiError.notFound('Message not found');
  return message;
};

/** Send the updated message to the room and return the viewer's version. */
const publishUpdate = async (message, group, viewerId) => {
  const lean = message.toObject ? message.toObject() : message;
  emitToGroup(group._id, SOCKET_EVENTS.CHAT_UPDATE, { message: await presentForRoom(lean, group) });
  const senders = await loadSenders([lean]);
  return toChatMessage(lean, { viewerId, senders, leaderId: group.leaderId });
};

/**
 * Vote in a poll (one vote per member; voting again moves the vote).
 * @param {string} groupId - Group
 * @param {string} userId - Voter
 * @param {string} messageId - Poll message
 * @param {number} optionIndex - Chosen option
 * @returns {Promise<Object>}
 */
const votePoll = async (groupId, userId, messageId, optionIndex) => {
  const { group } = await loadChatAccess(groupId, userId);
  const message = await findMessage(groupId, messageId);
  if (!message.poll || message.poll.closed) {
    throw ApiError.conflict('This poll is closed', { code: 'POLL_CLOSED' });
  }
  if (optionIndex < 0 || optionIndex >= message.poll.options.length) {
    throw new ApiError(422, 'Pick one of the options', { code: 'INVALID_OPTION' });
  }
  // Atomic: remove my vote everywhere, then add it to the chosen option
  const pullAll = Object.fromEntries(
    message.poll.options.map((_o, i) => [`poll.options.${i}.votes`, userId]),
  );
  await Message.updateOne({ _id: messageId }, { $pull: pullAll });
  const updated = await Message.findOneAndUpdate(
    { _id: messageId },
    { $addToSet: { [`poll.options.${optionIndex}.votes`]: userId } },
    { new: true },
  );
  return publishUpdate(updated, group, userId);
};

/**
 * Pin or unpin a message (leader only, at most 3 pinned).
 * @param {string} groupId - Group
 * @param {string} userId - Leader
 * @param {string} messageId - Message
 * @param {boolean} pinned - Pin or unpin
 * @returns {Promise<Object>}
 */
const setPinned = async (groupId, userId, messageId, pinned) => {
  const { group, isLeader } = await loadChatAccess(groupId, userId);
  if (!isLeader) throw ApiError.forbidden('Only the group leader can pin messages');
  const message = await findMessage(groupId, messageId);
  if (pinned && !message.pinned) {
    const count = await Message.countDocuments({ groupId, pinned: true });
    if (count >= MAX_PINNED) {
      throw ApiError.conflict(`You can pin up to ${MAX_PINNED} messages. Unpin one first.`, {
        code: 'TOO_MANY_PINNED',
      });
    }
  }
  message.pinned = pinned;
  await message.save();
  return publishUpdate(message, group, userId);
};

/**
 * Report a message; hidden after 3 different members report it.
 * @param {string} groupId - Group
 * @param {string} userId - Reporter
 * @param {string} messageId - Message
 * @param {string} [reason] - Optional reason
 * @returns {Promise<Object>}
 */
const reportMessage = async (groupId, userId, messageId, reason) => {
  const { group } = await loadChatAccess(groupId, userId);
  const message = await findMessage(groupId, messageId);
  if (String(message.senderId) === String(userId)) {
    throw new ApiError(422, 'You cannot report your own message', { code: 'OWN_MESSAGE' });
  }
  const updated = await Message.findOneAndUpdate(
    { _id: messageId, 'reports.userId': { $ne: userId } },
    { $push: { reports: { userId, reason } } },
    { new: true },
  );
  if (!updated) return publishUpdate(message, group, userId); // already reported by me
  if (!updated.hidden && updated.reports.length >= HIDE_AFTER_REPORTS) {
    updated.hidden = true;
    updated.pinned = false;
    await updated.save();
    log.warn({ groupId, messageId }, 'Message hidden after reports — needs Support review');
  }
  return publishUpdate(updated, group, userId);
};

/**
 * Check the dealer won this group and the chat is open to them.
 * @param {string} groupId
 * @param {string} sellerId - Dealer business (from requireSeller)
 * @returns {Promise<Object>} Group
 * @throws {ApiError} 404 when the group is not theirs or not won yet
 */
const loadDealerChatAccess = async (groupId, sellerId) => {
  const group = await Group.findById(groupId).select('leaderId status sellerId').lean();
  if (
    !group ||
    String(group.sellerId) !== String(sellerId) ||
    !DEALER_CHAT_STATUSES.includes(group.status)
  ) {
    throw ApiError.notFound('Group chat not found');
  }
  return group;
};

/**
 * Dealer view of the group chat (newest first).
 * @param {string} groupId
 * @param {{ sellerId: string, userId: string }} dealer
 * @param {{ before?: string, limit?: string }} query
 */
const listDealerMessages = async (groupId, { sellerId, userId }, query = {}) => {
  const group = await loadDealerChatAccess(groupId, sellerId);
  const pageSize = Math.min(Number.parseInt(query.limit, 10) || PAGE_SIZE, 50);
  const filter = { groupId };
  if (query.before) {
    const anchor = await Message.findOne({ _id: query.before, groupId }).select('createdAt').lean();
    if (anchor) filter.createdAt = { $lt: anchor.createdAt };
  }
  const page = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(pageSize + 1)
    .lean();
  const messages = page.slice(0, pageSize);
  const senders = await loadSenders(messages);
  const context = { viewerId: userId, senders, leaderId: group.leaderId };
  return {
    messages: messages.map((message) => ({
      ...toChatMessage(message, context),
      isMine: message.senderType === 'seller', // any team member sees the business's messages as ours
    })),
    hasMore: page.length > pageSize,
  };
};

/**
 * Dealer posts a text message to the group as the business.
 * @param {string} groupId
 * @param {{ sellerId: string, userId: string }} dealer
 * @param {{ text: string }} input
 */
const sendDealerMessage = async (groupId, { sellerId, userId }, { text }) => {
  const group = await loadDealerChatAccess(groupId, sellerId);
  await assertWithinLimit({
    key: `chat:${groupId}:seller:${sellerId}`,
    limit: 10,
    windowMs: 60_000,
    message: 'You are sending messages too fast. Please wait a moment.',
    code: 'CHAT_RATE_LIMIT',
  });
  const clean = text ? filterProfanity(text.trim()).text : '';
  if (!clean) throw new ApiError(422, 'Write a message', { code: 'EMPTY_MESSAGE' });
  const seller = await Seller.findById(sellerId).select('businessName').lean();
  const message = await Message.create({
    groupId,
    senderId: userId,
    senderType: 'seller',
    senderLabel: seller?.businessName || 'Dealer',
    text: clean,
  });
  const lean = message.toObject();
  emitToGroup(groupId, SOCKET_EVENTS.CHAT_MESSAGE, { message: await presentForRoom(lean, group) });
  return {
    ...toChatMessage(lean, { viewerId: userId, senders: new Map(), leaderId: group.leaderId }),
    isMine: true,
  };
};

module.exports = {
  toChatMessage,
  loadChatAccess,
  loadDealerChatAccess,
  listDealerMessages,
  sendDealerMessage,
  listMessages,
  getChatImageUploadParams,
  sendMessage,
  votePoll,
  setPinned,
  reportMessage,
};
