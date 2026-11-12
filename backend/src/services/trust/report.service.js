/**
 * Reports (TRU-3): anyone logged in can report a group, a member, a dealer, a chat message
 * or a review (spam, fraud, abuse, price not honoured). One report per person and target.
 * Support works the queue: dismiss, hide / restore the content, warn the dealer, or
 * suspend the account. A decision closes every open report on the same target.
 */
const Group = require('../../models/group.model');
const GroupMember = require('../../models/groupMember.model');
const Message = require('../../models/message.model');
const Product = require('../../models/product.model');
const Report = require('../../models/report.model');
const Review = require('../../models/review.model');
const Seller = require('../../models/seller.model');
const User = require('../../models/user.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const {
  firstNameOnly,
  getPagination,
  buildPaginationMeta,
} = require('../../helpers/genericFunctions');
const { recomputeSellerRating } = require('./rating.service');
const { applyPenalties } = require('./penalty.service');
const {
  ACCOUNT_STATUS,
  GROUP_VISIBILITY,
  MEMBER_STATUS,
  REPORT_STATUS,
  REPORT_TARGET: T,
} = require('../../constants/enums');

const log = createLogger('ReportService');
const SEATED = [MEMBER_STATUS.ACTIVE, MEMBER_STATUS.ACCEPTED, MEMBER_STATUS.PURCHASED];

/** Decisions Support can take, per target. */
const ACTIONS = Object.freeze({
  dismiss: [T.GROUP, T.MEMBER, T.SELLER, T.MESSAGE, T.REVIEW],
  hide_content: [T.MESSAGE, T.REVIEW],
  restore_content: [T.MESSAGE, T.REVIEW],
  warn_seller: [T.SELLER, T.REVIEW],
  suspend_account: [T.MEMBER, T.SELLER],
});

/**
 * Check the reporter may see what they report; returns the group for context.
 * @param {string} userId
 * @param {{ targetType: string, targetId: string, groupId?: string }} input
 * @returns {Promise<string|null>} groupId for context
 * @throws {ApiError} 404 when the target does not exist or is not visible
 */
const assertReportable = async (userId, { targetType, targetId, groupId }) => {
  const notFound = () => ApiError.notFound('We could not find what you are reporting');
  const isMemberOf = async (id) =>
    (await GroupMember.exists({ groupId: id, userId, status: { $in: SEATED } })) ||
    (await Group.exists({ _id: id, leaderId: userId }));

  if (targetType === T.GROUP) {
    const group = await Group.findById(targetId).select('visibility').lean();
    if (!group) throw notFound();
    if (group.visibility !== GROUP_VISIBILITY.PUBLIC && !(await isMemberOf(targetId)))
      throw notFound();
    return String(targetId);
  }
  if (targetType === T.MEMBER) {
    // Only people in the same group can report a member
    if (!groupId || !(await isMemberOf(groupId))) throw notFound();
    if (!(await GroupMember.exists({ groupId, userId: targetId }))) throw notFound();
    if (String(targetId) === String(userId))
      throw new ApiError(422, 'You cannot report yourself', { code: 'OWN_TARGET' });
    return String(groupId);
  }
  if (targetType === T.SELLER) {
    if (!(await Seller.exists({ _id: targetId }))) throw notFound();
    return groupId ? String(groupId) : null;
  }
  if (targetType === T.MESSAGE) {
    const message = await Message.findById(targetId).select('groupId senderId').lean();
    if (!message || !(await isMemberOf(message.groupId))) throw notFound();
    if (String(message.senderId) === String(userId)) {
      throw new ApiError(422, 'You cannot report your own message', { code: 'OWN_TARGET' });
    }
    return String(message.groupId);
  }
  if (targetType === T.REVIEW) {
    const review = await Review.findOne({ _id: targetId, status: 'published' })
      .select('groupId userId')
      .lean();
    if (!review) throw notFound();
    if (String(review.userId) === String(userId))
      throw new ApiError(422, 'You cannot report your own review', { code: 'OWN_TARGET' });
    return review.groupId ? String(review.groupId) : null;
  }
  throw notFound();
};

/**
 * Report something (TRU-3).
 * @param {string} userId
 * @param {{ targetType: string, targetId: string, groupId?: string, reason: string, details?: string }} input
 * @returns {Promise<{ id: string, status: string }>}
 * @throws {ApiError} 409 ALREADY_REPORTED
 */
const createReport = async (userId, input) => {
  const groupId = await assertReportable(userId, input);
  try {
    const report = await Report.create({
      reporterId: userId,
      targetType: input.targetType,
      targetId: input.targetId,
      groupId: groupId || undefined,
      reason: input.reason,
      details: input.details,
      timeline: [{ actorType: 'user', actorId: userId, action: 'reported', note: input.reason }],
    });
    // Chat messages also count toward the automatic hide after 3 reports (Day 8)
    if (input.targetType === T.MESSAGE) {
      const { reportMessage } = require('../chat/chat.service');
      await reportMessage(groupId, userId, input.targetId, input.reason).catch(() => {});
    }
    log.info({ reportId: String(report._id), targetType: input.targetType }, 'Report filed');
    return { id: String(report._id), status: report.status };
  } catch (err) {
    if (err?.code === 11000) {
      throw ApiError.conflict('You already reported this. Our team is looking into it.', {
        code: 'ALREADY_REPORTED',
      });
    }
    throw err;
  }
};

/**
 * What a report points to, for the queue (staff only: may include hidden content).
 * @param {Object} report
 */
const targetPreview = async ({ targetType, targetId }) => {
  if (targetType === T.GROUP) {
    const group = await Group.findById(targetId)
      .select('productId status visibility memberCount targetSize')
      .lean();
    const product = group
      ? await Product.findById(group.productId).select('brand model').lean()
      : null;
    return group
      ? {
          title: product ? `${product.brand} ${product.model}` : 'Group',
          subtitle: `${group.status} · ${group.memberCount}/${group.targetSize}`,
        }
      : null;
  }
  if (targetType === T.MEMBER) {
    const user = await User.findById(targetId).select('name status').lean();
    return user
      ? { title: firstNameOnly(user.name) || 'Member', subtitle: `Account ${user.status}` }
      : null;
  }
  if (targetType === T.SELLER) {
    const seller = await Seller.findById(targetId)
      .select('businessName status rating reviewCount')
      .lean();
    return seller
      ? {
          title: seller.businessName,
          subtitle: `Account ${seller.status} · rating ${seller.rating || 0} (${seller.reviewCount || 0})`,
        }
      : null;
  }
  if (targetType === T.MESSAGE) {
    const message = await Message.findById(targetId).populate('senderId', 'name').lean();
    return message
      ? {
          title: `${firstNameOnly(message.senderId?.name) || message.senderType}: ${message.text || '(photo)'}`,
          subtitle: message.hidden
            ? 'Hidden after reports'
            : `${message.reports?.length || 0} reports`,
          hidden: Boolean(message.hidden),
        }
      : null;
  }
  if (targetType === T.REVIEW) {
    const review = await Review.findById(targetId).populate('sellerId', 'businessName').lean();
    return review
      ? {
          title: `${review.rating}/5 for ${review.sellerId?.businessName || 'dealer'}: ${review.text || ''}`,
          subtitle: `Review ${review.status}`,
          hidden: review.status === 'hidden',
        }
      : null;
  }
  return null;
};

/** Queue row. */
const toAdminReport = async (report) => ({
  id: String(report._id),
  targetType: report.targetType,
  targetId: String(report.targetId),
  groupId: report.groupId ? String(report.groupId) : null,
  reason: report.reason,
  details: report.details || null,
  status: report.status,
  decision: report.decision?.at
    ? { action: report.decision.action, note: report.decision.note, at: report.decision.at }
    : null,
  reportCount: await Report.countDocuments({
    targetType: report.targetType,
    targetId: report.targetId,
  }),
  target: await targetPreview(report),
  timeline: report.timeline || [],
  createdAt: report.createdAt,
});

/** @param {{ status?: string, targetType?: string, page?: string, limit?: string }} query */
const adminListReports = async ({ status = REPORT_STATUS.OPEN, targetType, ...query } = {}) => {
  const pagination = getPagination(query);
  const filter = { status, ...(targetType ? { targetType } : {}) };
  const [rows, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: 1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    Report.countDocuments(filter),
  ]);
  return {
    reports: await Promise.all(rows.map(toAdminReport)),
    meta: buildPaginationMeta(total, pagination),
  };
};

/** Apply the decision to the reported thing. */
const applyAction = async (action, report, staffId, note) => {
  const { targetType, targetId } = report;
  if (action === 'hide_content' || action === 'restore_content') {
    const hidden = action === 'hide_content';
    if (targetType === T.MESSAGE) {
      await Message.updateOne(
        { _id: targetId },
        { $set: { hidden, ...(hidden ? { pinned: false } : {}) } },
      );
    } else {
      const review = await Review.findByIdAndUpdate(targetId, {
        $set: { status: hidden ? 'hidden' : 'published' },
      }).lean();
      if (review) await recomputeSellerRating(review.sellerId);
    }
  }
  if (action === 'warn_seller') {
    const sellerId =
      targetType === T.SELLER
        ? targetId
        : (await Review.findById(targetId).select('sellerId').lean())?.sellerId;
    if (sellerId)
      await applyPenalties(sellerId, ['warning'], { reason: `Report: ${note}`, staffId });
  }
  if (action === 'suspend_account') {
    if (targetType === T.SELLER)
      await Seller.updateOne({ _id: targetId }, { $set: { status: ACCOUNT_STATUS.SUSPENDED } });
    else
      await User.updateOne(
        { _id: targetId, staffRole: { $exists: false } },
        { $set: { status: ACCOUNT_STATUS.SUSPENDED } },
      );
  }
};

/**
 * Support decides a report; every open report on the same target is closed with it.
 * @param {string} reportId
 * @param {{ action: string, note: string }} input
 * @param {string} staffId
 * @returns {Promise<{ before: Object, after: Object, closed: number }>}
 */
const decideReport = async (reportId, { action, note }, staffId, now = new Date()) => {
  const report = await Report.findById(reportId).lean();
  if (!report) throw ApiError.notFound('Report not found');
  if (report.status !== REPORT_STATUS.OPEN)
    throw ApiError.conflict('This report is already closed', { code: 'REPORT_CLOSED' });
  if (!ACTIONS[action]?.includes(report.targetType)) {
    throw new ApiError(422, 'This action does not fit what was reported', {
      code: 'INVALID_ACTION',
    });
  }
  await applyAction(action, report, staffId, note);
  const status = action === 'dismiss' ? REPORT_STATUS.DISMISSED : REPORT_STATUS.RESOLVED;
  const result = await Report.updateMany(
    { targetType: report.targetType, targetId: report.targetId, status: REPORT_STATUS.OPEN },
    {
      $set: { status, decision: { action, note, by: staffId, at: now } },
      $push: { timeline: { at: now, actorType: 'staff', actorId: staffId, action, note } },
    },
  );
  log.info({ reportId, action, closed: result.modifiedCount }, 'Report decided');
  const after = await Report.findById(reportId).lean();
  return {
    before: { status: report.status },
    after: { status: after.status, decision: after.decision },
    closed: result.modifiedCount,
  };
};

module.exports = { ACTIONS, createReport, adminListReports, decideReport };
