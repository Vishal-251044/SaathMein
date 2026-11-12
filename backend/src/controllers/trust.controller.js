/**
 * Reports, disputes and dealer profiles for buyers (/api/reports, /api/disputes,
 * /api/sellers/:id), dealers (/api/seller/disputes) and Support (/api/admin/disputes,
 * /api/admin/reports). Staff decisions are audited with before / after.
 */
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const { setAudit } = require('../services/audit.service');
const reportService = require('../services/trust/report.service');
const disputeService = require('../services/trust/dispute.service');
const sellerPublic = require('../services/seller/sellerPublic.service');

/* ---------------------------------- Buyer ----------------------------------- */

/** POST /api/reports */
const createReport = asyncHandler(async (req, res) => {
  const report = await reportService.createReport(req.auth.userId, req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Thanks. Our team will look into it.',
    data: { report },
  });
});

/** POST /api/disputes/evidence-upload-params */
const buyerEvidenceParams = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: 'Upload ready',
    data: disputeService.buyerEvidenceUploadParams(req.auth.userId),
  }),
);

/** POST /api/disputes */
const openDispute = asyncHandler(async (req, res) => {
  const dispute = await disputeService.openDispute(req.auth.userId, req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Dispute opened', data: { dispute } });
});

/** GET /api/disputes */
const myDisputes = asyncHandler(async (req, res) => {
  const { disputes, meta } = await disputeService.listMyDisputes(
    req.auth.userId,
    req.validatedQuery,
  );
  return sendSuccess(res, { message: 'Disputes fetched', data: { disputes }, meta });
});

/** GET /api/disputes/:disputeId */
const myDispute = asyncHandler(async (req, res) => {
  const dispute = await disputeService.getMyDispute(req.auth.userId, req.params.disputeId);
  return sendSuccess(res, { message: 'Dispute fetched', data: { dispute } });
});

/** GET /api/sellers/:sellerId */
const sellerProfile = asyncHandler(async (req, res) => {
  const seller = await sellerPublic.getPublicSeller(req.params.sellerId);
  return sendSuccess(res, { message: 'Dealer fetched', data: { seller } });
});

/** GET /api/sellers/:sellerId/reviews */
const sellerReviews = asyncHandler(async (req, res) => {
  const { reviews, meta } = await sellerPublic.listSellerReviews(
    req.params.sellerId,
    req.validatedQuery,
  );
  return sendSuccess(res, { message: 'Reviews fetched', data: { reviews }, meta });
});

/* ---------------------------------- Dealer ---------------------------------- */

/** GET /api/seller/disputes?status= */
const sellerDisputes = asyncHandler(async (req, res) => {
  const { disputes, meta } = await disputeService.listSellerDisputes(
    req.seller.sellerId,
    req.validatedQuery,
  );
  return sendSuccess(res, { message: 'Disputes fetched', data: { disputes }, meta });
});

/** GET /api/seller/disputes/:disputeId */
const sellerDispute = asyncHandler(async (req, res) => {
  const dispute = await disputeService.getSellerDispute(req.seller.sellerId, req.params.disputeId);
  return sendSuccess(res, { message: 'Dispute fetched', data: { dispute } });
});

/** POST /api/seller/disputes/evidence-upload-params */
const sellerEvidenceParams = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: 'Upload ready',
    data: disputeService.sellerEvidenceUploadParams(req.seller.sellerId),
  }),
);

/** POST /api/seller/disputes/:disputeId/respond */
const respondDispute = asyncHandler(async (req, res) => {
  const dispute = await disputeService.respondToDispute(
    { sellerId: req.seller.sellerId, userId: req.auth.userId },
    req.params.disputeId,
    req.body,
  );
  return sendSuccess(res, { message: 'Answer sent', data: { dispute } });
});

/* ---------------------------------- Support --------------------------------- */

/** GET /api/admin/disputes?status= */
const adminDisputes = asyncHandler(async (req, res) => {
  const { disputes, meta } = await disputeService.adminListDisputes(req.validatedQuery);
  return sendSuccess(res, { message: 'Disputes fetched', data: { disputes }, meta });
});

/** GET /api/admin/disputes/:disputeId */
const adminDispute = asyncHandler(async (req, res) => {
  const dispute = await disputeService.getAdminDispute(req.params.disputeId);
  return sendSuccess(res, { message: 'Dispute fetched', data: { dispute } });
});

/** POST /api/admin/disputes/:disputeId/decide (money action: reason required) */
const decideDispute = asyncHandler(async (req, res) => {
  const { before, after } = await disputeService.decideDispute(
    req.params.disputeId,
    req.body,
    req.staff.userId,
  );
  setAudit(req, {
    action: 'dispute.decide',
    targetType: 'dispute',
    targetId: req.params.disputeId,
    before,
    after,
    reason: req.body.note,
  });
  return sendSuccess(res, { message: 'Dispute decided', data: { dispute: after } });
});

/** GET /api/admin/reports?status=&targetType= */
const adminReports = asyncHandler(async (req, res) => {
  const { reports, meta } = await reportService.adminListReports(req.validatedQuery);
  return sendSuccess(res, { message: 'Reports fetched', data: { reports }, meta });
});

/** POST /api/admin/reports/:reportId/decide */
const decideReport = asyncHandler(async (req, res) => {
  const { before, after, closed } = await reportService.decideReport(
    req.params.reportId,
    req.body,
    req.staff.userId,
  );
  setAudit(req, {
    action: `report.${req.body.action}`,
    targetType: 'report',
    targetId: req.params.reportId,
    before,
    after,
    reason: req.body.note,
  });
  return sendSuccess(res, { message: 'Report decided', data: { closed } });
});

module.exports = {
  createReport,
  buyerEvidenceParams,
  openDispute,
  myDisputes,
  myDispute,
  sellerProfile,
  sellerReviews,
  sellerDisputes,
  sellerDispute,
  sellerEvidenceParams,
  respondDispute,
  adminDisputes,
  adminDispute,
  decideDispute,
  adminReports,
  decideReport,
};
