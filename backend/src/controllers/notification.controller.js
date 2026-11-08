/**
 * Notifications controller — /api/notifications (notification centre + push tokens).
 */
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const notifications = require('../services/notifications/notification.service');

/** GET /api/notifications?page= */
const list = asyncHandler(async (req, res) => {
  const {
    notifications: items,
    unreadCount,
    meta,
  } = await notifications.listNotifications(req.auth.userId, req.validatedQuery);
  return sendSuccess(res, {
    message: 'Notifications fetched',
    data: { notifications: items, unreadCount },
    meta,
  });
});

/** POST /api/notifications/read — `{ ids }` or `{ all: true }` */
const markRead = asyncHandler(async (req, res) => {
  const unreadCount = await notifications.markRead(req.auth.userId, req.body);
  return sendSuccess(res, { message: 'Marked as read', data: { unreadCount } });
});

/** POST /api/notifications/push-token — this phone's Expo push token */
const registerPushToken = asyncHandler(async (req, res) => {
  await notifications.registerPushToken(req.auth.userId, req.body);
  return sendSuccess(res, { message: 'Push notifications on' });
});

/** DELETE /api/notifications/push-token — on logout */
const removePushToken = asyncHandler(async (req, res) => {
  await notifications.removePushToken(req.auth.userId, req.body.token);
  return sendSuccess(res, { message: 'Push notifications off for this phone' });
});

module.exports = { list, markRead, registerPushToken, removePushToken };
