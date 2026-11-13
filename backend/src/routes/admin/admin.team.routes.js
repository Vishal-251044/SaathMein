/**
 * Admin Team routes — /api/admin/team (ADL-1). Owner only (Admin, Finance, Deal Manager
 * and Support all get 403). Scoped by path because this router is mounted at /api/admin.
 */
const { Router } = require('express');
const validate = require('../../middlewares/validate.middleware');
const { requireStaff } = require('../../middlewares/staffAuth.middleware');
const controller = require('../../controllers/admin/adminTeam.controller');
const schemas = require('../../validators/monitor.validator');
const { STAFF_ROLE } = require('../../constants/enums');

const router = Router();

router.use('/team', requireStaff(STAFF_ROLE.OWNER));
router.get('/team', controller.getTeam);
router.post('/team/invites', validate(schemas.inviteStaffSchema), controller.inviteStaff);
router.delete('/team/invites/:inviteId', validate(schemas.inviteIdSchema), controller.revokeInvite);
router.patch('/team/:userId/role', validate(schemas.changeRoleSchema), controller.changeRole);
router.patch('/team/:userId/status', validate(schemas.staffStatusSchema), controller.setStatus);

module.exports = router;
