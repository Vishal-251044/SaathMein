/**
 * Admin Disputes and Reports queue — /api/admin/disputes, /api/admin/reports (TRU-3, TRU-4).
 * Allowed: Owner, Admin, Support (PRD §8.2). Deciding a dispute can move money, so the
 * reason note is required and the decision is audited.
 */
const { Router } = require('express');
const validate = require('../../middlewares/validate.middleware');
const { requireStaff } = require('../../middlewares/staffAuth.middleware');
const controller = require('../../controllers/trust.controller');
const schemas = require('../../validators/trust.validator');
const { STAFF_ROLE } = require('../../constants/enums');

const router = Router();

router.use(['/disputes', '/reports'], requireStaff(STAFF_ROLE.ADMIN, STAFF_ROLE.SUPPORT));

router.get('/disputes', validate(schemas.adminDisputesSchema), controller.adminDisputes);
router.get('/disputes/:disputeId', validate(schemas.disputeIdParams), controller.adminDispute);
router.post(
  '/disputes/:disputeId/decide',
  validate(schemas.decideDisputeSchema),
  controller.decideDispute,
);
router.get('/reports', validate(schemas.adminReportsSchema), controller.adminReports);
router.post(
  '/reports/:reportId/decide',
  validate(schemas.decideReportSchema),
  controller.decideReport,
);

module.exports = router;
