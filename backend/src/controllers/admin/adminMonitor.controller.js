/**
 * Admin monitors controller (PRD §10.11, MON-1..3): overview, groups, auctions with the
 * bid timeline, payments (Razorpay), dealers, buyers, disputes and system health, plus
 * the staff actions taken from them. Every action records a reason in the audit log.
 */
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/ApiResponse');
const { setAudit } = require('../../services/audit.service');
const monitor = require('../../services/monitor/monitor.service');
const paymentMonitor = require('../../services/monitor/paymentMonitor.service');
const actions = require('../../services/admin/staffActions.service');

/* ------------------------------- Read endpoints ------------------------------ */

/** GET /api/admin/monitor/overview?cityId=&categoryId= */
const getOverview = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: 'Overview fetched',
    data: await monitor.getOverview(req.validatedQuery),
  }),
);

/** GET /api/admin/monitor/groups?cityId=&categoryId= */
const getGroups = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: 'Groups monitor fetched',
    data: await monitor.getGroupsMonitor(req.validatedQuery),
  }),
);

/** GET /api/admin/monitor/auctions?status=live|recent */
const listAuctions = asyncHandler(async (req, res) => {
  const { auctions, meta } = await monitor.listAuctions(req.validatedQuery);
  return sendSuccess(res, { message: 'Auctions fetched', data: { auctions }, meta });
});

/** GET /api/admin/monitor/auctions/:groupId */
const getAuction = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: 'Auction fetched',
    data: { auction: await monitor.getAuctionDetail(req.params.groupId) },
  }),
);

/** GET /api/admin/monitor/payments/summary?from=&to= */
const getPaymentSummary = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: 'Payment monitor fetched',
    data: await paymentMonitor.getPaymentMonitor(req.validatedQuery),
  }),
);

/** GET /api/admin/monitor/payments?view=&q= */
const listPayments = asyncHandler(async (req, res) => {
  const { payments, meta } = await paymentMonitor.listPayments(req.validatedQuery);
  return sendSuccess(res, { message: 'Payments fetched', data: { payments }, meta });
});

/** GET /api/admin/monitor/dealers */
const listDealers = asyncHandler(async (req, res) => {
  const { dealers, meta } = await monitor.listDealers(req.validatedQuery);
  return sendSuccess(res, { message: 'Dealers fetched', data: { dealers }, meta });
});

/** GET /api/admin/monitor/buyers?q= */
const getBuyers = asyncHandler(async (req, res) => {
  const { meta, ...data } = await monitor.getBuyersMonitor(req.validatedQuery);
  return sendSuccess(res, { message: 'Buyers monitor fetched', data, meta });
});

/** GET /api/admin/monitor/disputes */
const getDisputes = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: 'Disputes monitor fetched',
    data: await monitor.getDisputesMonitor(),
  }),
);

/** GET /api/admin/monitor/system */
const getSystem = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'System health fetched', data: await monitor.getSystemHealth() }),
);

/** POST /api/admin/monitor/system/queues/:queue/retry */
const retryJobs = asyncHandler(async (req, res) => {
  const retried = await monitor.retryFailedJobs(req.params.queue);
  setAudit(req, {
    action: 'system.jobs.retry',
    targetType: 'queue',
    targetId: req.params.queue,
    after: { retried },
    reason: req.body.reason,
  });
  return sendSuccess(res, { message: `${retried} failed jobs retried`, data: { retried } });
});

/* ---------------------------------- Actions ---------------------------------- */

/**
 * Build a POST handler that runs a staff action and audits it.
 * @param {string} action - Audit action name
 * @param {string} targetType
 * @param {(req: import('express').Request) => string} targetId
 * @param {(req: import('express').Request) => Promise<{ before: Object, after: Object }>} run
 * @param {string} message - Success message
 */
const staffAction = (action, targetType, targetId, run, message) =>
  asyncHandler(async (req, res) => {
    const { before, after } = await run(req);
    setAudit(req, {
      action,
      targetType,
      targetId: targetId(req),
      before,
      after,
      reason: req.body.reason,
    });
    return sendSuccess(res, { message, data: { after } });
  });

const groupId = (req) => req.params.groupId;
const paymentId = (req) => req.params.paymentId;
const sellerId = (req) => req.params.sellerId;
const userId = (req) => req.params.userId;

const pauseAuction = staffAction(
  'auction.pause',
  'group',
  groupId,
  (req) => actions.pauseAuction(groupId(req)),
  'Auction paused',
);
const resumeAuction = staffAction(
  'auction.resume',
  'group',
  groupId,
  (req) => actions.resumeAuction(groupId(req)),
  'Auction resumed',
);
const extendAuction = staffAction(
  'auction.extend',
  'group',
  groupId,
  (req) => actions.extendAuction(groupId(req), req.body.hours),
  'Auction extended',
);
const cancelGroup = staffAction(
  'group.cancel',
  'group',
  groupId,
  (req) => actions.cancelGroup(groupId(req), req.staff.userId),
  'Group cancelled. Every token is being refunded.',
);
const forceRunnerUp = staffAction(
  'auction.force_runner_up',
  'group',
  groupId,
  (req) =>
    actions.forceRunnerUp(groupId(req), req.staff.userId, req.body.reason, req.body.penalise),
  'The group moved to the runner-up',
);
const extendGroup = staffAction(
  'group.extend',
  'group',
  groupId,
  (req) => actions.extendGroupDeadline(groupId(req), req.body.days),
  'Deadline extended',
);
const retryRefund = staffAction(
  'payment.refund.retry',
  'payment',
  paymentId,
  (req) => actions.retryRefund(paymentId(req)),
  'Refund retried',
);
const manualRefund = staffAction(
  'payment.refund.manual',
  'payment',
  paymentId,
  (req) => actions.manualRefund(paymentId(req), req.body.amountPaise, req.staff.userId),
  'Refund started',
);
const releaseHold = staffAction(
  'payment.hold.release',
  'payment',
  paymentId,
  (req) => actions.releasePaymentHold(paymentId(req)),
  'Hold released to the dealer',
);
const reverseHold = staffAction(
  'payment.hold.reverse',
  'payment',
  paymentId,
  (req) => actions.reversePaymentHold(paymentId(req), req.body.reason),
  'Transfer taken back from the dealer',
);
const penaliseDealer = staffAction(
  'seller.penalty.add',
  'seller',
  sellerId,
  (req) =>
    actions.penaliseDealer(sellerId(req), req.body.type, {
      reason: req.body.reason,
      staffId: req.staff.userId,
      days: req.body.days,
    }),
  'Penalty added',
);
const liftPenalty = staffAction(
  'seller.penalty.lift',
  'seller',
  sellerId,
  (req) =>
    actions.liftPenalty(sellerId(req), req.params.penaltyId, {
      reason: req.body.reason,
      staffId: req.staff.userId,
    }),
  'Penalty lifted',
);
const setBuyerStatus = staffAction(
  'user.status',
  'user',
  userId,
  (req) => actions.setBuyerStatus(userId(req), req.body.active),
  'Account updated',
);

module.exports = {
  getOverview,
  getGroups,
  listAuctions,
  getAuction,
  getPaymentSummary,
  listPayments,
  listDealers,
  getBuyers,
  getDisputes,
  getSystem,
  retryJobs,
  pauseAuction,
  resumeAuction,
  extendAuction,
  cancelGroup,
  forceRunnerUp,
  extendGroup,
  retryRefund,
  manualRefund,
  releaseHold,
  reverseHold,
  penaliseDealer,
  liftPenalty,
  setBuyerStatus,
};
