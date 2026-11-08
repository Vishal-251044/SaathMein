/**
 * Notifications (LIV-3, LIV-4): every notification is saved for the in-app centre (read /
 * unread) and sent live over the user's socket room; a push goes through the Expo push
 * service (FCM on Android). Quiet hours 22:00–08:00 IST: the push waits until 08:00 (the
 * minute sweep sends due pushes); the in-app item appears at once.
 * Never throws — notifying must not break the action that caused it.
 */
const Notification = require('../../models/notification.model');
const User = require('../../models/user.model');
const config = require('../../config/env');
const { createLogger } = require('../../utils/logger');
const { getPagination, buildPaginationMeta } = require('../../helpers/genericFunctions');
const { emitToUser } = require('../../sockets/emitter');
const { renderNotification } = require('./templates');
const { SOCKET_EVENTS } = require('../../constants/enums');

const log = createLogger('NotificationService');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH = 100;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const QUIET_START_HOUR = 22;
const QUIET_END_HOUR = 8;
const PUSH_BATCH = 200;

/**
 * Is it quiet hours in India?
 * @param {Date} [at]
 * @returns {boolean}
 */
const isQuietHours = (at = new Date()) => {
  const hour = new Date(at.getTime() + IST_OFFSET_MS).getUTCHours();
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
};

/**
 * The next 08:00 IST at or after `at` (when deferred pushes go out).
 * @param {Date} [at]
 * @returns {Date}
 */
const quietHoursEnd = (at = new Date()) => {
  const ist = new Date(at.getTime() + IST_OFFSET_MS);
  const end = new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), QUIET_END_HOUR),
  );
  if (ist.getUTCHours() >= QUIET_END_HOUR) end.setUTCDate(end.getUTCDate() + 1);
  return new Date(end.getTime() - IST_OFFSET_MS);
};

/** @param {string} token @returns {boolean} Looks like an Expo push token */
const isExpoToken = (token) => /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);

/**
 * Send pushes through Expo and remove tokens of uninstalled apps.
 * @param {{ to: string, title: string, body: string, data: Object, userId: string }[]} messages
 * @returns {Promise<{ sent: number, failed: number }>}
 */
const sendExpoPush = async (messages) => {
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < messages.length; i += EXPO_BATCH) {
    const batch = messages.slice(i, i + EXPO_BATCH);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(config.expo.accessToken
            ? { Authorization: `Bearer ${config.expo.accessToken}` }
            : {}),
        },
        body: JSON.stringify(
          batch.map(({ to, title, body, data }) => ({
            to,
            title,
            body,
            data,
            sound: 'default',
            channelId: 'default',
            priority: 'high',
          })),
        ),
        signal: AbortSignal.timeout(10_000),
      });
      const result = await response.json();
      const tickets = result.data || [];
      const dead = [];
      tickets.forEach((ticket, index) => {
        if (ticket.status === 'ok') sent += 1;
        else {
          failed += 1;
          if (ticket.details?.error === 'DeviceNotRegistered') dead.push(batch[index]);
        }
      });
      for (const message of dead) {
        await User.updateOne(
          { _id: message.userId },
          { $pull: { pushTokens: { token: message.to } } },
        );
      }
      if (!response.ok)
        log.error({ status: response.status }, '[NotificationService] Expo push request failed');
    } catch (err) {
      failed += batch.length;
      log.error(
        { err: err.message, count: batch.length },
        '[NotificationService] Expo push failed',
      );
    }
  }
  return { sent, failed };
};

/**
 * Notify users: save, send live, push now or at 08:00 IST.
 * @param {string[]} userIds - Recipients
 * @param {string} type - NOTIFICATION_TYPE
 * @param {Object} data - Text values + `{ groupId?, url? }` for the app
 * @param {{ now?: Date }} [options]
 * @returns {Promise<number>} Notifications created
 */
const notifyUsers = async (userIds, type, data = {}, { now = new Date() } = {}) => {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  if (!ids.length) return 0;
  try {
    const users = await User.find({ _id: { $in: ids } })
      .select('language +pushTokens status')
      .lean();
    const quiet = isQuietHours(now);
    const appData = {
      type,
      ...(data.groupId ? { groupId: String(data.groupId) } : {}),
      ...(data.url ? { url: data.url } : {}),
    };

    const docs = users
      .filter((user) => user.status !== 'deleted')
      .map((user) => {
        const { title, body } = renderNotification(type, user.language || 'en', data);
        const hasPush = (user.pushTokens || []).length > 0;
        return {
          userId: user._id,
          type,
          title,
          body,
          data: appData,
          push: hasPush
            ? quiet
              ? { status: 'deferred', sendAfter: quietHoursEnd(now) }
              : { status: 'sent' }
            : { status: 'none' },
        };
      });
    const created = await Notification.insertMany(docs);

    created.forEach((notification) =>
      emitToUser(notification.userId, SOCKET_EVENTS.NOTIFICATION, {
        notification: toAppNotification(notification),
      }),
    );

    if (!quiet) {
      const tokens = new Map(users.map((user) => [String(user._id), user.pushTokens || []]));
      const messages = created.flatMap((notification) =>
        tokens.get(String(notification.userId)).map(({ token }) => ({
          to: token,
          title: notification.title,
          body: notification.body,
          data: { ...appData, notificationId: String(notification._id) },
          userId: String(notification.userId),
        })),
      );
      if (messages.length) await sendExpoPush(messages);
    }
    return created.length;
  } catch (err) {
    log.error({ err: err.message, type, count: ids.length }, '[NotificationService] notify failed');
    return 0;
  }
};

/**
 * Minute sweep: send pushes that waited for the end of quiet hours.
 * @param {Date} [now]
 * @returns {Promise<number>} Notifications pushed
 */
const sendDeferredPushes = async (now = new Date()) => {
  if (isQuietHours(now)) return 0;
  const due = await Notification.find({
    'push.status': 'deferred',
    'push.sendAfter': { $lte: now },
  })
    .limit(PUSH_BATCH)
    .lean();
  if (!due.length) return 0;
  const users = await User.find({ _id: { $in: due.map((item) => item.userId) } })
    .select('+pushTokens')
    .lean();
  const tokens = new Map(users.map((user) => [String(user._id), user.pushTokens || []]));
  const messages = due.flatMap((item) =>
    (tokens.get(String(item.userId)) || []).map(({ token }) => ({
      to: token,
      title: item.title,
      body: item.body,
      data: { ...item.data, notificationId: String(item._id) },
      userId: String(item.userId),
    })),
  );
  await Notification.updateMany(
    { _id: { $in: due.map((item) => item._id) } },
    { $set: { 'push.status': 'sent' } },
  );
  if (messages.length) await sendExpoPush(messages);
  return due.length;
};

/** App shape of a notification. */
const toAppNotification = (notification) => ({
  id: String(notification._id),
  type: notification.type,
  title: notification.title,
  body: notification.body,
  data: notification.data || {},
  read: Boolean(notification.read),
  createdAt: notification.createdAt,
});

/**
 * Notification centre list (newest first) with the unread count.
 * @param {string} userId - User
 * @param {{ page?: string, limit?: string }} query
 * @returns {Promise<{ notifications: Object[], unreadCount: number, meta: Object }>}
 */
const listNotifications = async (userId, query) => {
  const pagination = getPagination(query);
  const [items, total, unreadCount] = await Promise.all([
    Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Notification.countDocuments({ userId }),
    Notification.countDocuments({ userId, read: false }),
  ]);
  return {
    notifications: items.map(toAppNotification),
    unreadCount,
    meta: buildPaginationMeta(total, pagination),
  };
};

/**
 * Mark some (or all) notifications read.
 * @param {string} userId - User
 * @param {{ ids?: string[], all?: boolean }} input
 * @returns {Promise<number>} Unread left
 */
const markRead = async (userId, { ids, all }) => {
  const filter = { userId, read: false, ...(all ? {} : { _id: { $in: ids || [] } }) };
  await Notification.updateMany(filter, { $set: { read: true, readAt: new Date() } });
  return Notification.countDocuments({ userId, read: false });
};

/**
 * Save this phone's Expo push token (moved here if another account used it before).
 * @param {string} userId - User
 * @param {{ token: string, platform: 'android'|'ios' }} input
 */
const registerPushToken = async (userId, { token, platform }) => {
  if (!isExpoToken(token)) return;
  await User.updateMany({ _id: { $ne: userId } }, { $pull: { pushTokens: { token } } });
  await User.updateOne({ _id: userId }, { $pull: { pushTokens: { token } } });
  await User.updateOne(
    { _id: userId },
    { $push: { pushTokens: { $each: [{ token, platform, updatedAt: new Date() }], $slice: -5 } } },
  );
};

/** Forget a push token (logout). */
const removePushToken = (userId, token) =>
  User.updateOne({ _id: userId }, { $pull: { pushTokens: { token } } });

module.exports = {
  isQuietHours,
  quietHoursEnd,
  isExpoToken,
  sendExpoPush,
  notifyUsers,
  sendDeferredPushes,
  toAppNotification,
  listNotifications,
  markRead,
  registerPushToken,
  removePushToken,
};
