/**
 * Admin Console Team (ADL-1, PRD §8.2): the Owner invites staff by email with a role,
 * changes roles and disables accounts. There is no public staff sign-up; the one Owner
 * comes only from `npm run create-owner` and can never be changed or disabled here.
 * Accepting an invite creates the account (name + password); 2FA is set up on first login.
 */
const User = require('../../models/user.model');
const StaffInvite = require('../../models/staffInvite.model');
const config = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { randomToken, hmacSha256 } = require('../../utils/crypto');
const { hashPassword } = require('../auth/staffAuth.service');
const { revokeUserSessions } = require('../auth/session.service');
const emailService = require('../email.service');
const { ACCOUNT_STATUS, STAFF_ROLE } = require('../../constants/enums');

const log = createLogger('StaffTeam');
const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
const ROLE_LABELS = {
  [STAFF_ROLE.OWNER]: 'Owner',
  [STAFF_ROLE.ADMIN]: 'Admin',
  [STAFF_ROLE.DEAL_MANAGER]: 'Deal Manager',
  [STAFF_ROLE.FINANCE]: 'Finance',
  [STAFF_ROLE.SUPPORT]: 'Support',
};

/** Keyed hash of an invite token (staff secret, so a buyer-side leak cannot forge one). */
const hashStaffInviteToken = (token) =>
  hmacSha256(`staff-invite:${token}`, config.auth.staff.refreshSecret);

const adminWebUrl = () => config.sellerWebUrl.replace(/\/seller$/, '');

/**
 * Staff members and pending invites.
 * @returns {Promise<{ members: Object[], invites: Object[] }>}
 */
const listTeam = async () => {
  const [members, invites] = await Promise.all([
    User.find({ staffRole: { $exists: true } })
      .select('name email staffRole status twoFactorEnabled lastLoginAt createdAt')
      .sort({ createdAt: 1 })
      .lean(),
    StaffInvite.find({ status: 'pending', expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  return {
    members: members.map((member) => ({
      userId: String(member._id),
      name: member.name || null,
      email: member.email || null,
      role: member.staffRole,
      status: member.status,
      twoFactorEnabled: Boolean(member.twoFactorEnabled),
      lastLoginAt: member.lastLoginAt || null,
      joinedAt: member.createdAt,
    })),
    invites: invites.map((invite) => ({
      id: String(invite._id),
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    })),
  };
};

/**
 * Invite a staff member (Owner only). Replaces an older pending invite for the email.
 * @param {string} ownerId
 * @param {{ email: string, role: string }} input
 * @returns {Promise<Object>} The invite (for the audit log)
 * @throws {ApiError} 409 EMAIL_TAKEN when the email already has an account
 */
const inviteStaff = async (ownerId, { email, role }) => {
  if (role === STAFF_ROLE.OWNER) throw ApiError.forbidden('There is only one Owner');
  // Staff accounts are separate from buyer / dealer accounts (separate sessions, PRD §8.2)
  if (await User.exists({ email })) {
    throw ApiError.conflict('This email already has a SaathMein account. Use a different email.', {
      code: 'EMAIL_TAKEN',
    });
  }
  const owner = await User.findById(ownerId).select('name email').lean();
  await StaffInvite.updateMany({ email, status: 'pending' }, { $set: { status: 'revoked' } });
  const token = randomToken(32);
  const invite = await StaffInvite.create({
    email,
    role,
    tokenHash: hashStaffInviteToken(token),
    invitedBy: ownerId,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });
  await emailService.sendStaffInvite({
    to: email,
    roleLabel: ROLE_LABELS[role],
    inviterName: owner?.name || 'The SaathMein Owner',
    url: `${adminWebUrl()}/admin/invite/${token}`,
  });
  log.info({ inviteId: String(invite._id), role }, 'Staff invited');
  return { id: String(invite._id), email, role, expiresAt: invite.expiresAt };
};

/** Cancel a pending invite. */
const revokeInvite = async (inviteId) => {
  const result = await StaffInvite.updateOne(
    { _id: inviteId, status: 'pending' },
    { $set: { status: 'revoked' } },
  );
  if (!result.matchedCount) throw ApiError.notFound('Invite not found');
};

/** Live invite by token, or 404 (expired, used and unknown look the same). */
const findLiveInvite = async (token) => {
  const invite = await StaffInvite.findOne({
    tokenHash: hashStaffInviteToken(token),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!invite) throw ApiError.notFound('This invitation is invalid or has expired');
  return invite;
};

/**
 * What the invite page shows before accepting.
 * @param {string} token
 * @returns {Promise<{ email: string, role: string, roleLabel: string }>}
 */
const previewInvite = async (token) => {
  const invite = await findLiveInvite(token);
  return { email: invite.email, role: invite.role, roleLabel: ROLE_LABELS[invite.role] };
};

/**
 * Accept: create the staff account. The invite is claimed atomically, so one link creates
 * one account. Sign-in (with mandatory 2FA setup) follows on /admin/login.
 * @param {string} token
 * @param {{ name: string, password: string }} input
 * @returns {Promise<{ email: string }>}
 */
const acceptInvite = async (token, { name, password }) => {
  const invite = await findLiveInvite(token);
  if (await User.exists({ email: invite.email })) {
    throw ApiError.conflict('This email already has a SaathMein account', { code: 'EMAIL_TAKEN' });
  }
  const passwordHash = await hashPassword(password);
  const claimed = await StaffInvite.findOneAndUpdate(
    { _id: invite._id, status: 'pending' },
    { $set: { status: 'accepted', acceptedAt: new Date() } },
    { new: true },
  );
  if (!claimed) throw ApiError.notFound('This invitation is invalid or has expired');
  const user = await User.create({
    name,
    email: invite.email,
    passwordHash,
    passwordChangedAt: new Date(),
    staffRole: invite.role,
    status: ACCOUNT_STATUS.ACTIVE,
    twoFactorEnabled: false,
  });
  await StaffInvite.updateOne({ _id: invite._id }, { $set: { acceptedBy: user._id } });
  log.info({ userId: String(user._id), role: invite.role }, 'Staff invite accepted');
  return { email: invite.email };
};

/** Staff member who is not the Owner, or 404 / 403. */
const loadMember = async (userId, actorId) => {
  const user = await User.findOne({ _id: userId, staffRole: { $exists: true } })
    .select('staffRole status email')
    .lean();
  if (!user) throw ApiError.notFound('Staff member not found');
  if (user.staffRole === STAFF_ROLE.OWNER)
    throw ApiError.forbidden('The Owner account cannot be changed here');
  if (String(userId) === String(actorId))
    throw ApiError.forbidden('You cannot change your own account');
  return user;
};

/**
 * Change a staff member's role (sessions end, so the new role applies on next sign-in).
 * @returns {Promise<{ before: Object, after: Object }>}
 */
const changeRole = async (userId, role, actorId) => {
  if (role === STAFF_ROLE.OWNER) throw ApiError.forbidden('There is only one Owner');
  const user = await loadMember(userId, actorId);
  await User.updateOne({ _id: userId }, { $set: { staffRole: role } });
  await revokeUserSessions(userId, 'role_changed');
  return { before: { role: user.staffRole }, after: { role } };
};

/**
 * Disable (sessions end now) or re-enable a staff account.
 * @returns {Promise<{ before: Object, after: Object }>}
 */
const setMemberActive = async (userId, active, actorId) => {
  const user = await loadMember(userId, actorId);
  const status = active ? ACCOUNT_STATUS.ACTIVE : ACCOUNT_STATUS.SUSPENDED;
  await User.updateOne({ _id: userId }, { $set: { status } });
  if (!active) await revokeUserSessions(userId, 'staff_disabled');
  return { before: { status: user.status }, after: { status } };
};

module.exports = {
  ROLE_LABELS,
  hashStaffInviteToken,
  listTeam,
  inviteStaff,
  revokeInvite,
  previewInvite,
  acceptInvite,
  changeRole,
  setMemberActive,
};
