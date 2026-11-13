/**
 * Alerts (PRD §10.11 Alerts, MON-2): raise once per problem (repeats only increase the
 * count), show in the console bell live (staff socket room), email the roles that handle
 * that type, and push to the Owner's phone through the buyer-app account linked in
 * settings (decided 13 Nov 2026). Never throws: an alert must not break the flow that
 * raised it.
 */
const Alert = require('../../models/alert.model');
const User = require('../../models/user.model');
const config = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { getPagination, buildPaginationMeta } = require('../../helpers/genericFunctions');
const { getSettings } = require('../settings.service');
const { sendEmail } = require('../email.service');
const { emitToStaff } = require('../../sockets/emitter');
const { ACCOUNT_STATUS, NOTIFICATION_TYPE, STAFF_ROLE } = require('../../constants/enums');

const log = createLogger('Alerts');

/** Who gets each alert type by email (the Owner always does). */
const RECIPIENT_ROLES = Object.freeze({
  payment: [STAFF_ROLE.FINANCE],
  auction: [STAFF_ROLE.DEAL_MANAGER],
  suspicious_bidding: [STAFF_ROLE.ADMIN],
  reconciliation: [STAFF_ROLE.FINANCE],
  system: [],
});

/** Admin console base URL (same site as the dealer dashboard). */
const consoleUrl = () => `${config.sellerWebUrl.replace(/\/seller$/, '')}/admin`;

/** Link inside the console for an alert's subject. */
const linkFor = ({ subjectType, subjectId }) => {
  if (subjectType === 'group') return `/admin/monitor/auctions/${subjectId}`;
  if (subjectType === 'payment') return '/admin/monitor/payments';
  if (subjectType === 'seller') return `/admin/sellers/${subjectId}`;
  if (subjectType === 'dispute') return `/admin/disputes/${subjectId}`;
  return '/admin/alerts';
};

/** Console view. */
const toAlertView = (alert) => ({
  id: String(alert._id),
  type: alert.type,
  severity: alert.severity,
  title: alert.title,
  message: alert.message || null,
  link: linkFor(alert),
  count: alert.count,
  status: alert.status,
  createdAt: alert.createdAt,
  lastSeenAt: alert.lastSeenAt,
});

/** Email + phone push for a new alert (best effort). */
const deliver = async (alert) => {
  try {
    const roles = [STAFF_ROLE.OWNER, ...(RECIPIENT_ROLES[alert.type] || [])];
    const staff = await User.find({
      staffRole: { $in: roles },
      status: ACCOUNT_STATUS.ACTIVE,
      email: { $exists: true },
    })
      .select('email')
      .lean();
    const to = staff.map((user) => user.email).filter(Boolean);
    if (to.length) {
      await sendEmail({
        to,
        subject: `[SaathMein alert] ${alert.title}`,
        text: `${alert.message || alert.title}\n\nOpen: ${consoleUrl()}${linkFor(alert).replace(/^\/admin/, '')}`,
      });
    }
    const { ownerPushPhone } = await getSettings('alerts');
    if (ownerPushPhone && ['warning', 'critical'].includes(alert.severity)) {
      const owner = await User.findOne({ phone: ownerPushPhone, status: ACCOUNT_STATUS.ACTIVE })
        .select('_id')
        .lean();
      if (owner) {
        const { notifyUsers } = require('../notifications/notification.service');
        await notifyUsers([owner._id], NOTIFICATION_TYPE.STAFF_ALERT, {
          title: alert.title,
          url: '/',
        });
      }
    }
  } catch (err) {
    log.warn({ err: err.message, alertId: String(alert._id) }, 'Alert delivery failed');
  }
};

/**
 * Raise an alert (or count a repeat of an open one).
 * @param {{ type: string, severity?: 'info'|'warning'|'critical', title: string, message?: string,
 *   subjectType?: string, subjectId?: string, dedupeKey: string }} input
 * @returns {Promise<Object|null>} The alert view, or null when it could not be saved
 */
const raiseAlert = async (input) => {
  try {
    const now = new Date();
    const repeat = await Alert.findOneAndUpdate(
      { dedupeKey: input.dedupeKey, status: { $in: ['open', 'ack'] } },
      { $inc: { count: 1 }, $set: { lastSeenAt: now } },
      { new: true },
    ).lean();
    if (repeat) return toAlertView(repeat);
    let alert;
    try {
      alert = (
        await Alert.create({
          ...input,
          subjectId: input.subjectId ? String(input.subjectId) : undefined,
          lastSeenAt: now,
        })
      ).toObject();
    } catch (err) {
      // Raised at the same moment by another process: count it instead
      if (err?.code !== 11000) throw err;
      return raiseAlert(input);
    }
    const view = toAlertView(alert);
    emitToStaff('alert:new', view);
    log.warn({ type: input.type, title: input.title, dedupeKey: input.dedupeKey }, 'Alert raised');
    await deliver(alert);
    return view;
  } catch (err) {
    log.error({ err: err.message, type: input.type }, '[Alerts] could not raise alert');
    return null;
  }
};

/** @param {{ status?: string, type?: string, page?: string, limit?: string }} query */
const listAlerts = async ({ status, type, ...query } = {}) => {
  const pagination = getPagination(query);
  const filter = {
    ...(status === 'active' || !status ? { status: { $in: ['open', 'ack'] } } : { status }),
    ...(type ? { type } : {}),
  };
  const [rows, total, open] = await Promise.all([
    Alert.find(filter)
      .sort({ lastSeenAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Alert.countDocuments(filter),
    Alert.countDocuments({ status: 'open' }),
  ]);
  return {
    alerts: rows.map(toAlertView),
    openCount: open,
    meta: buildPaginationMeta(total, pagination),
  };
};

/**
 * Acknowledge (someone is on it) or close an alert.
 * @param {string} alertId
 * @param {'ack'|'close'} action
 * @param {string} staffId
 */
const updateAlert = async (alertId, action, staffId) => {
  const now = new Date();
  const update =
    action === 'ack'
      ? { $set: { status: 'ack', ackBy: staffId, ackAt: now } }
      : { $set: { status: 'closed', closedBy: staffId, closedAt: now } };
  const alert = await Alert.findOneAndUpdate(
    { _id: alertId, status: { $in: action === 'ack' ? ['open'] : ['open', 'ack'] } },
    update,
    { new: true },
  ).lean();
  if (!alert) throw ApiError.conflict('This alert was already handled', { code: 'ALERT_HANDLED' });
  emitToStaff('alert:updated', toAlertView(alert));
  return toAlertView(alert);
};

module.exports = { RECIPIENT_ROLES, raiseAlert, listAlerts, updateAlert, toAlertView };
