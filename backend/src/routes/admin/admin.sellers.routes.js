/**
 * Admin seller routes — /api/admin/sellers, /product-requests and /audit-logs.
 * Sellers + product requests: Owner, Admin, Deal Manager. Audit log: Owner, Admin (PRD §8.2).
 * Guards are scoped by path because this router is mounted at /api/admin.
 */
const { Router } = require('express');
const validate = require('../../middlewares/validate.middleware');
const { requireStaff } = require('../../middlewares/staffAuth.middleware');
const controller = require('../../controllers/admin/adminSellers.controller');
const schemas = require('../../validators/seller.validator');
const { STAFF_ROLE } = require('../../constants/enums');

const router = Router();

router.use(
  ['/sellers', '/product-requests'],
  requireStaff(STAFF_ROLE.ADMIN, STAFF_ROLE.DEAL_MANAGER),
);
router.use('/audit-logs', requireStaff(STAFF_ROLE.ADMIN));

router.get('/sellers', validate(schemas.adminListSellersSchema), controller.listSellers);
router.get(
  '/sellers/:sellerId',
  validate({ params: schemas.sellerIdParams }),
  controller.getSeller,
);
router.post(
  '/sellers/:sellerId/kyc/approve',
  validate(schemas.approveKycSchema),
  controller.approveKyc,
);
router.post(
  '/sellers/:sellerId/kyc/reject',
  validate(schemas.rejectKycSchema),
  controller.rejectKyc,
);
router.post(
  '/sellers/:sellerId/razorpay/retry',
  validate({ params: schemas.sellerIdParams }),
  controller.retryPayoutSetup,
);

router.get(
  '/product-requests',
  validate(schemas.adminProductRequestsSchema),
  controller.listProductRequests,
);
router.patch(
  '/product-requests/:requestId',
  validate(schemas.updateProductRequestSchema),
  controller.updateProductRequest,
);

router.get('/audit-logs', validate(schemas.auditLogsSchema), controller.getAuditLogs);

module.exports = router;
