/**
 * Membership rules around money (GRP-5, GRP-6, PAY-2, PAY-3):
 * - who may pay to join (open seat, community access, waitlist seat offer);
 * - leaving: full refund while open, token minus back-out fee after seats lock;
 * - waitlist: free to join when full; a freed seat is offered to the next person for 2 h
 *   (settings.payments.waitlistOfferHours), then to the next.
 */
const Group = require('../../models/group.model');
const GroupMember = require('../../models/groupMember.model');
const Payment = require('../../models/payment.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { withTransaction } = require('../../utils/transaction');
const { getPaymentSettings } = require('../settings.service');
const { queueRefund, REFUND_REASON } = require('../payments/refund.service');
const { reverseHeldTransfer } = require('../payments/route.service');
const { isQuietHours, quietHoursEnd } = require('../notifications/notification.service');
const { publishGroupCount, notifyAboutGroup } = require('./groupLive');
const {
  GROUP_STATUS,
  GROUP_VISIBILITY,
  MEMBER_STATUS,
  NOTIFICATION_TYPE,
  PAYMENT_STATUS,
} = require('../../constants/enums');

const log = createLogger('Membership');
const HOUR_MS = 60 * 60 * 1000;
const SEATED = [MEMBER_STATUS.ACTIVE, MEMBER_STATUS.ACCEPTED, MEMBER_STATUS.PURCHASED];

/**
 * Throw unless this person may get into a community group (GRP-6).
 * @param {Object} group - Lean group
 * @param {string} userId - Buyer
 * @param {Object|null} membership - Their GroupMember (lean)
 * @param {string} [code] - Invite code they used
 * @throws {ApiError} 403 / 404
 */
const assertCommunityAccess = (group, userId, membership, code) => {
  if (group.visibility !== GROUP_VISIBILITY.COMMUNITY) return;
  if (String(group.leaderId) === String(userId)) return;
  if (membership?.status === MEMBER_STATUS.REJECTED) {
    throw ApiError.forbidden('The group leader declined your request');
  }
  if (group.requiresApproval) {
    if (![MEMBER_STATUS.APPROVED, MEMBER_STATUS.WAITLISTED].includes(membership?.status)) {
      throw new ApiError(403, 'Wait for the group leader to approve you', {
        code: 'APPROVAL_REQUIRED',
      });
    }
    return;
  }
  const hasCode = code && code.toUpperCase() === group.inviteCode;
  if (!hasCode && !membership) throw ApiError.notFound('Group not found');
};

/**
 * Who may start a token checkout for this group right now.
 * @param {Object} group - Lean group
 * @param {string} userId - Buyer
 * @param {Object|null} membership - GroupMember (lean)
 * @param {{ code?: string, reservedSeats: number, now?: Date }} context
 * @returns {{ viaOffer: boolean }}
 * @throws {ApiError} 409 ALREADY_MEMBER / GROUP_FULL / SEATS_RESERVED / GROUP_CLOSED
 */
const assertCanJoin = (group, userId, membership, { code, reservedSeats, now = new Date() }) => {
  if (membership && SEATED.includes(membership.status)) {
    throw ApiError.conflict('You are already in this group', { code: 'ALREADY_MEMBER' });
  }
  assertCommunityAccess(group, userId, membership, code);

  const hasOffer =
    membership?.status === MEMBER_STATUS.WAITLISTED &&
    membership.offerExpiresAt &&
    new Date(membership.offerExpiresAt) > now;

  const offerSeatOpen = group.status === GROUP_STATUS.FULL || isInExitWindow(group, now);
  if (offerSeatOpen && hasOffer && group.memberCount < group.targetSize) {
    return { viaOffer: true };
  }
  if (group.status === GROUP_STATUS.FULL) {
    throw ApiError.conflict('This group is full. Join the waitlist to get the next free seat.', {
      code: 'GROUP_FULL',
    });
  }
  if (group.status !== GROUP_STATUS.OPEN) {
    throw ApiError.conflict('This group is no longer taking members', { code: 'GROUP_CLOSED' });
  }
  if (group.deadline <= now && !group.leaderDecisionDueAt) {
    throw ApiError.conflict('This group has reached its deadline', { code: 'GROUP_CLOSED' });
  }
  if (group.memberCount + reservedSeats >= group.targetSize) {
    throw ApiError.conflict(
      'All remaining seats are in checkout right now. Try again in a few minutes or join the waitlist.',
      { code: 'SEATS_RESERVED' },
    );
  }
  return { viaOffer: false };
};

/**
 * Is a won group still in its 24 h exit window?
 * @param {Object} group - Group
 * @param {Date} [now]
 * @returns {boolean}
 */
const isInExitWindow = (group, now = new Date()) =>
  [GROUP_STATUS.WON, GROUP_STATUS.PURCHASING].includes(group.status) &&
  Boolean(group.exitWindowEndsAt) &&
  new Date(group.exitWindowEndsAt) > now;

/**
 * What leaving would refund (PAY-3).
 * @param {Object} group - Group
 * @param {Object|null} membership - Seated membership with paymentId
 * @param {Object|null} payment - Paid token payment
 * @returns {{ canLeave: boolean, reason?: string, refundPaise: number, feePaise: number, tokenPaise: number }}
 */
const computeLeaveTerms = (group, membership, payment, now = new Date()) => {
  const tokenPaise = payment?.amountPaise ?? group.tokenAmountPaise;
  if (!membership || membership.status !== MEMBER_STATUS.ACTIVE || !payment) {
    return { canLeave: false, reason: 'NOT_A_MEMBER', refundPaise: 0, feePaise: 0, tokenPaise };
  }
  if (group.status === GROUP_STATUS.OPEN) {
    return { canLeave: true, refundPaise: tokenPaise, feePaise: 0, tokenPaise };
  }
  if (group.status === GROUP_STATUS.FULL) {
    const feePaise = Math.min(group.backoutFeePaise ?? 0, tokenPaise);
    return { canLeave: true, refundPaise: tokenPaise - feePaise, feePaise, tokenPaise };
  }
  // After a win: 24 h exit window, refund minus the back-out fee (PRD §10.5)
  if (isInExitWindow(group, now)) {
    const feePaise = Math.min(group.backoutFeePaise ?? 0, tokenPaise);
    return {
      canLeave: true,
      refundPaise: tokenPaise - feePaise,
      feePaise,
      tokenPaise,
      exitWindowEndsAt: group.exitWindowEndsAt,
    };
  }
  // During the auction (and after the exit window) seats stay locked
  return { canLeave: false, reason: 'SEATS_LOCKED', refundPaise: 0, feePaise: 0, tokenPaise };
};

/**
 * Load the group, membership and paid payment for one member.
 * @returns {Promise<{ group: Object, membership: Object|null, payment: Object|null }>}
 */
const loadMember = async (groupId, userId) => {
  const group = await Group.findById(groupId).lean();
  if (!group) throw ApiError.notFound('Group not found');
  const membership = await GroupMember.findOne({ groupId, userId }).lean();
  const payment = membership?.paymentId
    ? await Payment.findOne({
        _id: membership.paymentId,
        // After a win the token may be held at the dealer (transferred, on hold)
        status: { $in: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.TRANSFERRED] },
      }).lean()
    : null;
  return { group, membership, payment };
};

/**
 * Refund preview for the "Leave group" sheet.
 * @param {string} groupId - Group id
 * @param {string} userId - Member
 * @returns {Promise<Object>} computeLeaveTerms result
 */
const leavePreview = async (groupId, userId) => {
  const { group, membership, payment } = await loadMember(groupId, userId);
  return computeLeaveTerms(group, membership, payment);
};

/**
 * Leave a group and get the token back (minus the back-out fee after lock). The seat is
 * freed in one transaction; the refund is queued; a full group offers the seat to the
 * waitlist.
 * @param {string} groupId - Group id
 * @param {string} userId - Member
 * @returns {Promise<Object>} The terms applied
 * @throws {ApiError} 409 CANNOT_LEAVE
 */
const leaveGroup = async (groupId, userId) => {
  const { group, membership, payment } = await loadMember(groupId, userId);
  const terms = computeLeaveTerms(group, membership, payment);
  if (!terms.canLeave) {
    throw ApiError.conflict(
      terms.reason === 'SEATS_LOCKED'
        ? 'Seats are locked while dealers bid. You can exit after the auction.'
        : 'You are not a paid member of this group',
      { code: 'CANNOT_LEAVE', details: { reason: terms.reason } },
    );
  }

  // Token held at the dealer (exit window after a win): take it back first, so it can be
  // refunded (PAY-4). If this fails the member stays and can try again.
  if (payment.status === PAYMENT_STATUS.TRANSFERRED) {
    await reverseHeldTransfer(payment._id, 'member_exit');
  }

  await withTransaction(async (session) => {
    const left = await GroupMember.updateOne(
      { _id: membership._id, status: MEMBER_STATUS.ACTIVE },
      { $set: { status: MEMBER_STATUS.LEFT, leftAt: new Date() } },
      { session },
    );
    // Only while the group is still open/full (not if the auction started a moment ago)
    const freed = await Group.updateOne(
      { _id: group._id, status: group.status, memberCount: { $gt: 0 } },
      { $inc: { memberCount: -1 } },
      { session },
    );
    if (!left.modifiedCount || !freed.modifiedCount) {
      throw ApiError.conflict('This group changed a moment ago. Please refresh.', {
        code: 'GROUP_CHANGED',
      });
    }
  });

  await queueRefund(payment._id, {
    reason:
      group.status === GROUP_STATUS.OPEN
        ? REFUND_REASON.LEFT_OPEN_GROUP
        : group.status === GROUP_STATUS.FULL
          ? REFUND_REASON.LEFT_AFTER_LOCK
          : REFUND_REASON.LEFT_AFTER_WIN,
    amountPaise: terms.refundPaise,
    feePaise: terms.feePaise,
  });
  if (group.status !== GROUP_STATUS.OPEN && group.status !== GROUP_STATUS.FULL) {
    // Exit window after a win: the deal code stops working (loaded here: avoids a cycle)
    const { cancelMemberPurchase } = require('../purchases/purchase.service');
    await cancelMemberPurchase(membership._id);
  }
  await publishGroupCount(groupId);
  // Freed seats go to the waitlist (after a win: at the same price, PRD §10.5)
  if (group.status !== GROUP_STATUS.OPEN) await offerNextSeat(groupId);
  log.info(
    { groupId, userId, refundPaise: terms.refundPaise, feePaise: terms.feePaise },
    'Member left',
  );
  return terms;
};

/**
 * Join the waitlist of a full group (free; the seat is paid when offered).
 * @param {string} groupId - Group id
 * @param {string} userId - Buyer
 * @param {{ code?: string }} [options]
 * @returns {Promise<{ position: number }>}
 */
const joinWaitlist = async (groupId, userId, { code } = {}) => {
  const group = await Group.findById(groupId).lean();
  if (!group) throw ApiError.notFound('Group not found');
  const membership = await GroupMember.findOne({ groupId, userId }).lean();
  if (membership && SEATED.includes(membership.status)) {
    throw ApiError.conflict('You are already in this group', { code: 'ALREADY_MEMBER' });
  }
  if (membership?.status === MEMBER_STATUS.WAITLISTED)
    return { position: membership.waitlistPosition };
  assertCommunityAccess(group, userId, membership, code);
  if (![GROUP_STATUS.FULL, GROUP_STATUS.AUCTION_LIVE, GROUP_STATUS.WON].includes(group.status)) {
    throw ApiError.conflict(
      group.status === GROUP_STATUS.OPEN
        ? 'Seats are still free. Join the group instead.'
        : 'This group is closed',
      { code: group.status === GROUP_STATUS.OPEN ? 'SEATS_AVAILABLE' : 'GROUP_CLOSED' },
    );
  }

  const last = await GroupMember.findOne({ groupId, waitlistPosition: { $exists: true } })
    .sort({ waitlistPosition: -1 })
    .select('waitlistPosition')
    .lean();
  const position = (last?.waitlistPosition ?? 0) + 1;
  await GroupMember.updateOne(
    { groupId, userId },
    {
      $set: { status: MEMBER_STATUS.WAITLISTED, waitlistPosition: position, joinedAt: new Date() },
      $unset: { leftAt: 1, offerExpiresAt: 1 },
    },
    { upsert: true },
  );
  await offerNextSeat(groupId);
  return { position };
};

/** Leave the waitlist. @returns {Promise<void>} */
const leaveWaitlist = async (groupId, userId) => {
  const result = await GroupMember.updateOne(
    { groupId, userId, status: MEMBER_STATUS.WAITLISTED },
    { $set: { status: MEMBER_STATUS.LEFT, leftAt: new Date() }, $unset: { offerExpiresAt: 1 } },
  );
  if (!result.matchedCount) throw ApiError.notFound('You are not on the waitlist');
  await offerNextSeat(groupId);
};

/**
 * Offer a free seat of a full group to the next person on the waitlist (one live offer
 * per free seat).
 * @param {string} groupId - Group id
 * @param {Date} [now] - Current time (tests)
 * @returns {Promise<number>} New offers made
 */
const offerNextSeat = async (groupId, now = new Date()) => {
  const group = await Group.findById(groupId)
    .select('status memberCount targetSize exitWindowEndsAt')
    .lean();
  if (!group) return 0;
  if (group.status !== GROUP_STATUS.FULL && !isInExitWindow(group, now)) return 0;
  const free = group.targetSize - group.memberCount;
  if (free <= 0) return 0;

  const liveOffers = await GroupMember.countDocuments({
    groupId,
    status: MEMBER_STATUS.WAITLISTED,
    offerExpiresAt: { $gt: now },
  });
  const { waitlistOfferHours } = await getPaymentSettings();
  // Offers made at night run from 08:00, so nobody loses a seat while asleep
  const offerStart = isQuietHours(now) ? quietHoursEnd(now) : now;
  let offered = 0;
  for (let i = liveOffers; i < free; i += 1) {
    const next = await GroupMember.findOneAndUpdate(
      { groupId, status: MEMBER_STATUS.WAITLISTED, offerExpiresAt: { $exists: false } },
      { $set: { offerExpiresAt: new Date(offerStart.getTime() + waitlistOfferHours * HOUR_MS) } },
      { sort: { waitlistPosition: 1 }, new: true },
    );
    if (!next) break;
    offered += 1;
    await notifyAboutGroup(next.userId, groupId, NOTIFICATION_TYPE.SEAT_OFFER);
    log.info(
      { groupId: String(groupId), userId: String(next.userId) },
      'Seat offered from waitlist',
    );
  }
  return offered;
};

/**
 * Minute sweep: expired seat offers go to the back of the waitlist; the seat is offered to
 * the next person.
 * @param {Date} [now] - Current time
 * @returns {Promise<number>} Offers expired
 */
const expireSeatOffers = async (now = new Date()) => {
  const expired = await GroupMember.find({
    status: MEMBER_STATUS.WAITLISTED,
    offerExpiresAt: { $lte: now },
  })
    .select('_id groupId')
    .limit(200)
    .lean();
  for (const member of expired) {
    const last = await GroupMember.findOne({
      groupId: member.groupId,
      waitlistPosition: { $exists: true },
    })
      .sort({ waitlistPosition: -1 })
      .select('waitlistPosition')
      .lean();
    await GroupMember.updateOne(
      { _id: member._id, offerExpiresAt: { $lte: now } },
      {
        $unset: { offerExpiresAt: 1 },
        $set: { waitlistPosition: (last?.waitlistPosition ?? 0) + 1 },
      },
    );
  }
  const groups = [...new Set(expired.map((member) => String(member.groupId)))];
  for (const groupId of groups) await offerNextSeat(groupId, now);
  return expired.length;
};

module.exports = {
  SEATED,
  isInExitWindow,
  assertCommunityAccess,
  assertCanJoin,
  computeLeaveTerms,
  leavePreview,
  leaveGroup,
  joinWaitlist,
  leaveWaitlist,
  offerNextSeat,
  expireSeatOffers,
};
