/**
 * Audit service (ADL-5) — writes and reads the append-only staff audit log.
 * Controllers describe what happened with `setAudit(req, ...)`; the audit middleware writes
 * the entry after a successful response. `recordAudit` writes directly (e.g. logins).
 */
const AuditLog = require('../models/auditLog.model');
const { createLogger } = require('../utils/logger');
const { getPagination, buildPaginationMeta } = require('../helpers/genericFunctions');
const { toCsv } = require('../utils/csv');

const DAY_MS = 24 * 60 * 60 * 1000;
const CSV_LIMIT = 10_000;

const log = createLogger('AuditService');

// Never store these in before/after snapshots
// ("code" only as a whole key, so fields like `pincodes` are kept)
const SECRET_KEYS =
  /password|secret|token|otp|signature|accountNumber|account_number|^code$|^codeHash$|backupCodes/i;

/**
 * Remove secrets and limit size of a snapshot.
 * @param {*} value - Snapshot (object, array or primitive)
 * @param {number} [depth=0] - Recursion depth
 * @returns {*} Safe copy
 */
const sanitize = (value, depth = 0) => {
  if (value == null || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (depth > 5) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitize(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SECRET_KEYS.test(key) ? '[redacted]' : sanitize(item, depth + 1),
    ]),
  );
};

/**
 * Keep only the top-level fields that changed between two snapshots.
 * @param {Object|null} before - Snapshot before the change
 * @param {Object|null} after - Snapshot after the change
 * @returns {{ before: Object|null, after: Object|null }} Changed fields only
 */
const diffSnapshots = (before, after) => {
  if (!before || !after) return { before: before ?? null, after: after ?? null };
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (key) => key !== 'updatedAt' && JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
  return {
    before: Object.fromEntries(keys.map((key) => [key, before[key]])),
    after: Object.fromEntries(keys.map((key) => [key, after[key]])),
  };
};

/**
 * Describe the current request's action for the audit middleware.
 * @param {import('express').Request} req - Express request
 * @param {{ action: string, targetType?: string, targetId?: string, before?: Object, after?: Object, reason?: string }} entry
 */
const setAudit = (req, entry) => {
  req.audit = { ...req.audit, ...entry };
};

/**
 * Write an audit entry now (best effort — never breaks the request).
 * @param {Object} entry - Fields of AuditLog
 * @returns {Promise<void>}
 */
const recordAudit = async (entry) => {
  try {
    await AuditLog.create({
      ...entry,
      before: sanitize(entry.before),
      after: sanitize(entry.after),
    });
  } catch (err) {
    log.error({ err: err.message, action: entry.action }, 'Could not write audit log');
  }
};

/**
 * Mongo filter for the audit viewer. `action` matches a prefix ("auction." finds every
 * auction action); `to` includes that whole day.
 */
const buildAuditFilter = ({ targetType, targetId, actorId, action, from, to }) => {
  const filter = {};
  if (targetType) filter.targetType = targetType;
  if (targetId) filter.targetId = targetId;
  if (actorId) filter.actorId = actorId;
  // Prefix match on the escaped action text (validator already limits it to [a-z0-9._])
  if (action) filter.action = new RegExp(`^${action.replace(/\./g, '\\.')}`);
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lt = new Date(new Date(to).getTime() + DAY_MS);
  }
  return filter;
};

/**
 * Audit history, newest first.
 * @param {{ targetType?: string, targetId?: string, actorId?: string, action?: string,
 *   from?: string, to?: string, page?: string, limit?: string }} query
 * @returns {Promise<{ entries: Object[], meta: Object }>}
 */
const listAuditLogs = async ({ page, limit, ...query }) => {
  const pagination = getPagination({ page, limit });
  const filter = buildAuditFilter(query);

  const [entries, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('actorId', 'name email staffRole')
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    entries: entries.map((entry) => ({
      id: String(entry._id),
      action: entry.action,
      actor: entry.actorId
        ? {
            id: String(entry.actorId._id),
            name: entry.actorId.name || entry.actorId.email,
            role: entry.actorRole,
          }
        : null,
      targetType: entry.targetType || null,
      targetId: entry.targetId || null,
      reason: entry.reason || null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      ip: entry.ip || null,
      createdAt: entry.createdAt,
    })),
    meta: buildPaginationMeta(total, pagination),
  };
};

/**
 * Audit log as CSV (MON-1), newest first, up to 10,000 rows.
 * @param {Object} query - Same filters as listAuditLogs
 * @returns {Promise<string>} CSV text
 */
const exportAuditLogsCsv = async (query) => {
  const entries = await AuditLog.find(buildAuditFilter(query))
    .sort({ createdAt: -1 })
    .limit(CSV_LIMIT)
    .populate('actorId', 'name email')
    .lean();
  return toCsv([
    [
      'Time',
      'Actor',
      'Role',
      'Action',
      'Target type',
      'Target ID',
      'Reason',
      'Before',
      'After',
      'IP',
    ],
    ...entries.map((entry) => [
      new Date(entry.createdAt).toISOString(),
      entry.actorId ? entry.actorId.name || entry.actorId.email : '',
      entry.actorRole || '',
      entry.action,
      entry.targetType || '',
      entry.targetId || '',
      entry.reason || '',
      entry.before == null ? '' : JSON.stringify(entry.before),
      entry.after == null ? '' : JSON.stringify(entry.after),
      entry.ip || '',
    ]),
  ]);
};

module.exports = {
  sanitize,
  diffSnapshots,
  setAudit,
  recordAudit,
  listAuditLogs,
  exportAuditLogsCsv,
};
