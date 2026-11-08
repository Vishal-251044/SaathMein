/**
 * Group chat controller — /api/groups/:groupId/messages (LIV-5).
 */
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const chatService = require('../services/chat/chat.service');

/** GET /api/groups/:groupId/messages?before= */
const listMessages = asyncHandler(async (req, res) => {
  const data = await chatService.listMessages(
    req.params.groupId,
    req.auth.userId,
    req.validatedQuery,
  );
  return sendSuccess(res, { message: 'Messages fetched', data });
});

/** POST /api/groups/:groupId/messages */
const sendMessage = asyncHandler(async (req, res) => {
  const message = await chatService.sendMessage(req.params.groupId, req.auth.userId, req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Message sent', data: { message } });
});

/** POST /api/groups/:groupId/messages/image-upload-params */
const imageUploadParams = asyncHandler(async (req, res) => {
  const data = await chatService.getChatImageUploadParams(req.params.groupId, req.auth.userId);
  return sendSuccess(res, { message: 'Upload authorised', data });
});

/** POST /api/groups/:groupId/messages/:messageId/vote */
const vote = asyncHandler(async (req, res) => {
  const message = await chatService.votePoll(
    req.params.groupId,
    req.auth.userId,
    req.params.messageId,
    req.body.optionIndex,
  );
  return sendSuccess(res, { message: 'Vote saved', data: { message } });
});

/** POST /api/groups/:groupId/messages/:messageId/pin (leader) */
const pin = asyncHandler(async (req, res) => {
  const message = await chatService.setPinned(
    req.params.groupId,
    req.auth.userId,
    req.params.messageId,
    req.body.pinned,
  );
  return sendSuccess(res, { message: req.body.pinned ? 'Pinned' : 'Unpinned', data: { message } });
});

/** POST /api/groups/:groupId/messages/:messageId/report */
const report = asyncHandler(async (req, res) => {
  const message = await chatService.reportMessage(
    req.params.groupId,
    req.auth.userId,
    req.params.messageId,
    req.body.reason,
  );
  return sendSuccess(res, { message: 'Thanks. Our team will review it.', data: { message } });
});

module.exports = { listMessages, sendMessage, imageUploadParams, vote, pin, report };
