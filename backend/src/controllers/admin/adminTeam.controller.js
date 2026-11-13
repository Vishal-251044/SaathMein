/**
 * Admin alerts centre (MON-4) and Team (ADL-1) controller.
 * Alerts: every staff member sees and handles them. Team: Owner only, plus the public
 * invite page (preview + accept) that creates the staff account.
 */
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/ApiResponse');
const { setAudit } = require('../../services/audit.service');
const alerts = require('../../services/alerts/alert.service');
const team = require('../../services/admin/staffTeam.service');

/** GET /api/admin/alerts?status=&type= */
const listAlerts = asyncHandler(async (req, res) => {
  const { alerts: rows, openCount, meta } = await alerts.listAlerts(req.validatedQuery);
  return sendSuccess(res, { message: 'Alerts fetched', data: { alerts: rows, openCount }, meta });
});

/** PATCH /api/admin/alerts/:alertId  { action: 'ack'|'close' } */
const updateAlert = asyncHandler(async (req, res) => {
  const alert = await alerts.updateAlert(req.params.alertId, req.body.action, req.staff.userId);
  setAudit(req, {
    action: `alert.${req.body.action}`,
    targetType: 'alert',
    targetId: req.params.alertId,
    after: { status: alert.status },
  });
  return sendSuccess(res, { message: 'Alert updated', data: { alert } });
});

/** GET /api/admin/team */
const getTeam = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Team fetched', data: await team.listTeam() }),
);

/** POST /api/admin/team/invites */
const inviteStaff = asyncHandler(async (req, res) => {
  const invite = await team.inviteStaff(req.staff.userId, req.body);
  setAudit(req, {
    action: 'staff.invite',
    targetType: 'staff_invite',
    targetId: invite.id,
    after: { email: invite.email, role: invite.role },
  });
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Invitation sent',
    data: await team.listTeam(),
  });
});

/** DELETE /api/admin/team/invites/:inviteId */
const revokeInvite = asyncHandler(async (req, res) => {
  await team.revokeInvite(req.params.inviteId);
  setAudit(req, {
    action: 'staff.invite.revoke',
    targetType: 'staff_invite',
    targetId: req.params.inviteId,
  });
  return sendSuccess(res, { message: 'Invitation cancelled', data: await team.listTeam() });
});

/** PATCH /api/admin/team/:userId/role */
const changeRole = asyncHandler(async (req, res) => {
  const { before, after } = await team.changeRole(
    req.params.userId,
    req.body.role,
    req.staff.userId,
  );
  setAudit(req, {
    action: 'staff.role',
    targetType: 'user',
    targetId: req.params.userId,
    before,
    after,
    reason: req.body.reason,
  });
  return sendSuccess(res, { message: 'Role changed', data: await team.listTeam() });
});

/** PATCH /api/admin/team/:userId/status */
const setStatus = asyncHandler(async (req, res) => {
  const { before, after } = await team.setMemberActive(
    req.params.userId,
    req.body.active,
    req.staff.userId,
  );
  setAudit(req, {
    action: 'staff.status',
    targetType: 'user',
    targetId: req.params.userId,
    before,
    after,
    reason: req.body.reason,
  });
  return sendSuccess(res, {
    message: req.body.active ? 'Account enabled' : 'Account disabled',
    data: await team.listTeam(),
  });
});

/** GET /api/admin/auth/invites/:token (public) */
const previewInvite = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: 'Invitation fetched',
    data: { invite: await team.previewInvite(req.params.token) },
  }),
);

/** POST /api/admin/auth/invites/:token/accept (public) */
const acceptInvite = asyncHandler(async (req, res) => {
  const result = await team.acceptInvite(req.params.token, req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Account created. Sign in to set up 2-step verification.',
    data: result,
  });
});

module.exports = {
  listAlerts,
  updateAlert,
  getTeam,
  inviteStaff,
  revokeInvite,
  changeRole,
  setStatus,
  previewInvite,
  acceptInvite,
};
