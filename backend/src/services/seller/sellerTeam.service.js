/**
 * Dealer team (F31): list members and invites, invite staff by email, revoke invites and
 * remove staff. Only the owner manages the team; the owner cannot be removed.
 */
const Seller = require('../../models/seller.model');
const SellerStaff = require('../../models/sellerStaff.model');
const SellerInvite = require('../../models/sellerInvite.model');
const User = require('../../models/user.model');
const config = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { randomToken } = require('../../utils/crypto');
const { hashInviteToken } = require('./sellerAuth.service');
const emailService = require('../email.service');

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TEAM_SIZE = 20;

/**
 * Team members and pending invites.
 * @param {string} sellerId - Seller id
 * @returns {Promise<{ members: Object[], invites: Object[] }>}
 */
const listTeam = async (sellerId) => {
  const [members, invites] = await Promise.all([
    SellerStaff.find({ sellerId, status: 'active' })
      .populate('userId', 'name email')
      .sort({ createdAt: 1 })
      .lean(),
    SellerInvite.find({ sellerId, status: 'pending', expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  return {
    members: members
      .filter((member) => member.userId)
      .map((member) => ({
        userId: String(member.userId._id),
        name: member.userId.name || null,
        email: member.userId.email || null,
        role: member.role,
        joinedAt: member.createdAt,
      })),
    invites: invites.map((invite) => ({
      id: String(invite._id),
      email: invite.email,
      name: invite.name || null,
      expiresAt: invite.expiresAt,
    })),
  };
};

/**
 * Invite a staff member by email (sends a 7-day link).
 * @param {string} sellerId - Seller id
 * @param {string} inviterId - Owner's user id
 * @param {{ email: string, name?: string }} input
 * @returns {Promise<Object>} Updated team
 */
const inviteStaff = async (sellerId, inviterId, { email, name }) => {
  const [seller, inviter, activeCount] = await Promise.all([
    Seller.findById(sellerId).select('businessName').lean(),
    User.findById(inviterId).select('name email').lean(),
    SellerStaff.countDocuments({ sellerId, status: 'active' }),
  ]);
  if (activeCount >= MAX_TEAM_SIZE) {
    throw new ApiError(422, `A team can have at most ${MAX_TEAM_SIZE} people`, {
      code: 'TEAM_FULL',
    });
  }

  const existingUser = await User.findOne({ email }).select('_id staffRole').lean();
  if (existingUser?.staffRole)
    throw ApiError.conflict('Staff accounts cannot join dealer teams', { code: 'EMAIL_TAKEN' });
  // One dealer team per person (requireSeller resolves a single team)
  const membership =
    existingUser &&
    (await SellerStaff.findOne({ userId: existingUser._id, status: 'active' })
      .select('sellerId')
      .lean());
  if (membership) {
    const sameTeam = String(membership.sellerId) === String(sellerId);
    throw ApiError.conflict(
      sameTeam
        ? 'This person is already in your team'
        : 'This person already works with another dealer on SaathMein',
      { code: sameTeam ? 'ALREADY_MEMBER' : 'IN_OTHER_TEAM' },
    );
  }

  // One live invite per email: replace older ones
  await SellerInvite.updateMany(
    { sellerId, email, status: 'pending' },
    { $set: { status: 'revoked' } },
  );
  const token = randomToken(32);
  await SellerInvite.create({
    sellerId,
    email,
    name,
    tokenHash: hashInviteToken(token),
    invitedBy: inviterId,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });

  await emailService.sendTeamInvite({
    to: email,
    businessName: seller.businessName,
    inviterName: inviter?.name || inviter?.email || 'Your colleague',
    url: `${config.sellerWebUrl}/invite/${token}`,
  });
  return listTeam(sellerId);
};

/**
 * Cancel a pending invite.
 * @param {string} sellerId - Seller id
 * @param {string} inviteId - Invite id
 * @returns {Promise<Object>} Updated team
 */
const revokeInvite = async (sellerId, inviteId) => {
  const result = await SellerInvite.updateOne(
    { _id: inviteId, sellerId, status: 'pending' },
    { $set: { status: 'revoked' } },
  );
  if (!result.matchedCount) throw ApiError.notFound('Invite not found');
  return listTeam(sellerId);
};

/**
 * Remove a staff member (the owner cannot be removed).
 * @param {string} sellerId - Seller id
 * @param {string} userId - Member to remove
 * @returns {Promise<Object>} Updated team
 */
const removeMember = async (sellerId, userId) => {
  const member = await SellerStaff.findOne({ sellerId, userId, status: 'active' });
  if (!member) throw ApiError.notFound('Team member not found');
  if (member.role === 'owner')
    throw new ApiError(422, 'The owner cannot be removed', { code: 'OWNER_REQUIRED' });
  member.status = 'removed';
  member.removedAt = new Date();
  await member.save();
  return listTeam(sellerId);
};

module.exports = { listTeam, inviteStaff, revokeInvite, removeMember };
