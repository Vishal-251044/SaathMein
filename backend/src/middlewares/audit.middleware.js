/**
 * Audit-log middleware (ADL-5): records EVERY successful admin write (POST/PUT/PATCH/DELETE)
 * after the response is sent — who, what, before/after, when, IP. Controllers add detail
 * with `setAudit(req, { action, targetType, targetId, before, after, reason })`; writes
 * without detail are still logged with the method and route.
 * Mount after requireStaff so `req.staff` is known.
 */
const { recordAudit } = require('../services/audit.service');

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {Function} next - Next middleware
 */
const auditAdminWrites = (req, res, next) => {
  if (!WRITE_METHODS.has(req.method)) return next();

  res.on('finish', () => {
    if (res.statusCode >= 400) return; // failed requests changed nothing
    const detail = req.audit || {};
    const routePath = `${req.baseUrl}${req.route?.path || ''}`;
    recordAudit({
      actorId: req.staff?.userId,
      actorRole: req.staff?.role,
      action: detail.action || `${req.method} ${routePath}`,
      targetType: detail.targetType,
      targetId: detail.targetId ? String(detail.targetId) : undefined,
      reason: detail.reason,
      before: detail.before,
      after: detail.after,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      statusCode: res.statusCode,
      ip: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 300),
      requestId: req.id,
    });
  });
  return next();
};

module.exports = { auditAdminWrites };
