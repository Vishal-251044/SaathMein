/**
 * Admin sellers controller — KYC queue, review, payout-account retry (PRD §10.11 Sellers,
 * TRU-1, PAY-4), plus the product-request inbox and the audit log viewer (ADL-5).
 */
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/ApiResponse');
const { setAudit, listAuditLogs } = require('../../services/audit.service');
const sellerAdmin = require('../../services/seller/sellerAdmin.service');
const productRequests = require('../../services/productRequest.service');

/** GET /api/admin/sellers?kycStatus=&q=&page=&limit= */
const listSellers = asyncHandler(async (req, res) => {
  const { sellers, meta } = await sellerAdmin.listSellers(req.validatedQuery);
  return sendSuccess(res, { message: 'Sellers fetched', data: { sellers }, meta });
});

/** GET /api/admin/sellers/:sellerId */
const getSeller = asyncHandler(async (req, res) => {
  const seller = await sellerAdmin.getSellerDetail(req.params.sellerId);
  return sendSuccess(res, { message: 'Seller fetched', data: { seller } });
});

/** POST /api/admin/sellers/:sellerId/kyc/approve */
const approveKyc = asyncHandler(async (req, res) => {
  const { seller, before } = await sellerAdmin.approveKyc(req.params.sellerId, req.staff.userId);
  setAudit(req, {
    action: 'seller.kyc.approve',
    targetType: 'seller',
    targetId: req.params.sellerId,
    before,
    after: { kycStatus: seller.kyc.status },
    reason: req.body.note,
  });
  return sendSuccess(res, { message: 'KYC approved', data: { seller } });
});

/** POST /api/admin/sellers/:sellerId/kyc/reject */
const rejectKyc = asyncHandler(async (req, res) => {
  const { seller, before } = await sellerAdmin.rejectKyc(
    req.params.sellerId,
    req.staff.userId,
    req.body.reason,
  );
  setAudit(req, {
    action: 'seller.kyc.reject',
    targetType: 'seller',
    targetId: req.params.sellerId,
    before,
    after: { kycStatus: seller.kyc.status },
    reason: req.body.reason,
  });
  return sendSuccess(res, { message: 'KYC sent back to the dealer', data: { seller } });
});

/** POST /api/admin/sellers/:sellerId/razorpay/retry */
const retryPayoutSetup = asyncHandler(async (req, res) => {
  const seller = await sellerAdmin.retryPayoutSetup(req.params.sellerId);
  setAudit(req, {
    action: 'seller.razorpay.retry',
    targetType: 'seller',
    targetId: req.params.sellerId,
    after: { razorpayStatus: seller.razorpay?.status },
  });
  return sendSuccess(res, { message: 'Payout setup retried', data: { seller } });
});

/** GET /api/admin/product-requests?status=&page=&limit= */
const listProductRequests = asyncHandler(async (req, res) => {
  const { requests, meta } = await productRequests.listProductRequests(req.validatedQuery);
  return sendSuccess(res, { message: 'Requests fetched', data: { requests }, meta });
});

/** PATCH /api/admin/product-requests/:requestId */
const updateProductRequest = asyncHandler(async (req, res) => {
  const { request, before } = await productRequests.updateProductRequest(
    req.params.requestId,
    req.body,
    req.staff.userId,
  );
  setAudit(req, {
    action: 'productRequest.update',
    targetType: 'productRequest',
    targetId: req.params.requestId,
    before,
    after: { status: request.status },
  });
  return sendSuccess(res, { message: 'Request updated', data: { request } });
});

/** GET /api/admin/audit-logs?targetType=&targetId=&actorId=&action=&page=&limit= */
const getAuditLogs = asyncHandler(async (req, res) => {
  const { entries, meta } = await listAuditLogs(req.validatedQuery);
  return sendSuccess(res, { message: 'Audit log fetched', data: { entries }, meta });
});

module.exports = {
  listSellers,
  getSeller,
  approveKyc,
  rejectKyc,
  retryPayoutSetup,
  listProductRequests,
  updateProductRequest,
  getAuditLogs,
};
