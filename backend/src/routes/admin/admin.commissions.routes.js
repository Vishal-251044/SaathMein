/**
 * Admin commission routes — /api/admin/commissions, /api/admin/commission-invoices.
 * Allowed: Owner, Admin, Finance (PRD §8.2). Support and Deal Manager get 403.
 */
const { Router } = require('express');
const validate = require('../../middlewares/validate.middleware');
const { requireStaff } = require('../../middlewares/staffAuth.middleware');
const controller = require('../../controllers/admin/adminCommissions.controller');
const schemas = require('../../validators/purchase.validator');
const { STAFF_ROLE } = require('../../constants/enums');

const router = Router();

router.use(
  ['/commissions', '/commission-invoices'],
  requireStaff(STAFF_ROLE.ADMIN, STAFF_ROLE.FINANCE),
);
router.get('/commissions', validate(schemas.adminCommissionsSchema), controller.listCommissions);
router.get('/commission-invoices', validate(schemas.adminInvoicesSchema), controller.listInvoices);
router.post(
  '/commission-invoices/generate',
  validate(schemas.generateInvoicesSchema),
  controller.generateInvoices,
);
router.get(
  '/commission-invoices/:invoiceId',
  validate(schemas.invoiceIdParams),
  controller.getInvoice,
);

module.exports = router;
